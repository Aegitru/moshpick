'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, ArrowLeft, CheckCircle, XCircle, Trash2, Settings, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import type { Edition, Festival, Stage } from '@/lib/types'

interface ClashfinderPreview {
  name: string
  artistCount: number
  stageCount: number
  lastEdit: string
}

export default function AdminEditionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: festivalId } = use(params)
  const { currentGroup } = useAppStore()
  const [festival, setFestival] = useState<Festival | null>(null)
  const [editions, setEditions] = useState<Edition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ year: new Date().getFullYear(), start_date: '', end_date: '', clashfinder_slug: '' })
  const [saving, setSaving] = useState(false)
  const [slugPreview, setSlugPreview] = useState<ClashfinderPreview | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [stagesEdition, setStagesEdition] = useState<string | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [linkingEdition, setLinkingEdition] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [festivalId])

  async function loadData() {
    setLoading(true)
    const [{ data: festData }, { data: editionsData }] = await Promise.all([
      supabase.from('festivals').select('*').eq('id', festivalId).single(),
      supabase.from('editions').select('*').eq('festival_id', festivalId).order('year', { ascending: false }),
    ])
    setFestival(festData as Festival)
    setEditions((editionsData ?? []) as Edition[])
    setLoading(false)
  }

  async function verifySlug() {
    if (!form.clashfinder_slug) return
    setSlugChecking(true)
    setSlugError(null)
    setSlugPreview(null)
    const res = await fetch(`/api/clashfinder/verify?slug=${form.clashfinder_slug}`)
    if (res.ok) {
      setSlugPreview(await res.json())
    } else {
      setSlugError('Slug invalide ou introuvable sur Clashfinder.')
    }
    setSlugChecking(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: newEd } = await supabase.from('editions').insert({
      festival_id: festivalId,
      year: form.year,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      clashfinder_slug: form.clashfinder_slug || null,
    }).select().single()

    // Link to group
    if (newEd && currentGroup) {
      await supabase.from('group_editions').upsert({ group_id: currentGroup.id, edition_id: newEd.id })
    }

    setSaving(false)
    setShowForm(false)
    setForm({ year: new Date().getFullYear(), start_date: '', end_date: '', clashfinder_slug: '' })
    setSlugPreview(null)
    loadData()
  }

  async function handleImport(edition: Edition) {
    if (!edition.clashfinder_slug) return
    setImporting(edition.id)
    const res = await fetch('/api/clashfinder/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editionId: edition.id, slug: edition.clashfinder_slug }),
    })
    const result = await res.json()
    alert(res.ok ? `Import réussi: ${result.artistCount} artistes, ${result.stageCount} scènes.` : `Erreur: ${result.error}`)
    setImporting(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette édition ?')) return
    await supabase.from('editions').delete().eq('id', id)
    setEditions(prev => prev.filter(e => e.id !== id))
  }

  async function loadStages(editionId: string) {
    const { data } = await supabase.from('stages').select('*').eq('edition_id', editionId).order('order')
    setStages((data ?? []) as Stage[])
    setStagesEdition(editionId)
  }

  async function updateStage(stageId: string, field: string, value: string | boolean | number) {
    await supabase.from('stages').update({ [field]: value }).eq('id', stageId)
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, [field]: value } : s))
  }

  async function linkToGroup(editionId: string) {
    if (!currentGroup) return
    setLinkingEdition(editionId)
    await supabase.from('group_editions').upsert({ group_id: currentGroup.id, edition_id: editionId })
    setLinkingEdition(null)
    alert('Édition liée au groupe!')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/festivals" className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Festivals
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{festival?.name ?? 'Festival'}</h1>
          <p className="text-gray-500 text-sm">{festival?.location}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle édition
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Créer une édition</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Année *</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(p => ({ ...p, year: +e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Début</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Fin</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Clashfinder slug */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Slug Clashfinder</label>
              <div className="flex gap-2">
                <input
                  value={form.clashfinder_slug}
                  onChange={e => { setForm(p => ({ ...p, clashfinder_slug: e.target.value })); setSlugPreview(null); setSlugError(null) }}
                  placeholder="hf26"
                  className="flex-1 px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={verifySlug}
                  disabled={!form.clashfinder_slug || slugChecking}
                  className="px-4 py-2.5 bg-[#252525] hover:bg-[#333] text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {slugChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
                </button>
              </div>
              {slugPreview && (
                <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 inline mr-2" />
                  <span className="text-green-400">{slugPreview.name}</span>
                  <span className="text-gray-400 ml-2">· {slugPreview.artistCount} artistes · {slugPreview.stageCount} scènes</span>
                </div>
              )}
              {slugError && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  <XCircle className="w-4 h-4 inline mr-2" />{slugError}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer l'édition
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-[#252525] text-gray-400 rounded-lg hover:bg-[#333] transition-colors">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Editions list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : (
        <div className="space-y-4">
          {editions.map(ed => (
            <div key={ed.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-lg">{festival?.name} {ed.year}</h3>
                  {ed.start_date && <p className="text-sm text-gray-500">{ed.start_date} → {ed.end_date}</p>}
                  {ed.clashfinder_slug && (
                    <a
                      href={`https://clashfinder.com/s/${ed.clashfinder_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1"
                    >
                      clashfinder.com/s/{ed.clashfinder_slug}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {ed.clashfinder_last_synced_at && (
                    <p className="text-xs text-gray-600 mt-1">Synchronisé: {new Date(ed.clashfinder_last_synced_at).toLocaleDateString('fr-FR')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentGroup && (
                    <button
                      onClick={() => linkToGroup(ed.id)}
                      disabled={linkingEdition === ed.id}
                      className="px-3 py-1.5 text-xs bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center gap-1"
                    >
                      {linkingEdition === ed.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Lier au groupe
                    </button>
                  )}
                  {ed.clashfinder_slug && (
                    <button
                      onClick={() => handleImport(ed)}
                      disabled={importing === ed.id}
                      className="px-3 py-1.5 text-xs bg-green-600/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors flex items-center gap-1"
                    >
                      {importing === ed.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Importer Clashfinder
                    </button>
                  )}
                  <Link
                    href={`/admin/lineup/${ed.id}`}
                    className="px-3 py-1.5 text-xs bg-[#252525] border border-[#333] text-gray-300 rounded-lg hover:bg-[#333] transition-colors"
                  >
                    Lineup
                  </Link>
                  <button onClick={() => loadStages(ed.id)} className="p-2 text-gray-500 hover:text-white transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(ed.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stage config */}
              {stagesEdition === ed.id && stages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#252525]">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Configuration des scènes</h4>
                  <div className="space-y-2">
                    {stages.map(s => (
                      <div key={s.id} className="flex items-center gap-3">
                        <input
                          value={s.icon ?? ''}
                          onChange={e => updateStage(s.id, 'icon', e.target.value)}
                          placeholder="🎸"
                          className="w-12 px-2 py-1 bg-[#111] border border-[#333] rounded text-center text-sm"
                        />
                        <span className="flex-1 text-sm text-gray-300">{s.name}</span>
                        <input
                          value={s.color ?? ''}
                          onChange={e => updateStage(s.id, 'color', e.target.value)}
                          placeholder="#7c3aed"
                          className="w-24 px-2 py-1 bg-[#111] border border-[#333] rounded text-xs text-gray-300"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={s.is_primary}
                            onChange={e => updateStage(s.id, 'is_primary', e.target.checked)}
                            className="rounded"
                          />
                          Principale
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {editions.length === 0 && (
            <div className="text-center py-12 text-gray-500">Aucune édition. Créez-en une ci-dessus.</div>
          )}
        </div>
      )}
    </div>
  )
}
