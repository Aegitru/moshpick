'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Loader2, Edit2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Artist, Stage } from '@/lib/types'

interface LineupEntry {
  id: string
  artist: Artist
  stage: Stage | null
  day: string | null
  start_time: string | null
  end_time: string | null
}

export default function AdminLineupPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params)
  const [entries, setEntries] = useState<LineupEntry[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ artistName: '', stageId: '', day: '', startTime: '', endTime: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => { loadData() }, [editionId])

  async function loadData() {
    setLoading(true)
    const [{ data: eas }, { data: stagesData }] = await Promise.all([
      supabase.from('edition_artists').select('id, day, start_time, end_time, artists(*), stages(*)').eq('edition_id', editionId).order('day').order('start_time'),
      supabase.from('stages').select('*').eq('edition_id', editionId).order('order'),
    ])

    setEntries((eas ?? []).map((ea: any) => ({
      id: ea.id,
      artist: ea.artists,
      stage: ea.stages,
      day: ea.day,
      start_time: ea.start_time,
      end_time: ea.end_time,
    })))
    setStages(stagesData ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // Find or create artist
    const { data: existing } = await supabase.from('artists').select('id').ilike('name', form.artistName).single()
    let artistId = existing?.id
    if (!artistId) {
      const { data: newArtist } = await supabase.from('artists').insert({ name: form.artistName }).select('id').single()
      artistId = newArtist?.id
    }

    if (artistId) {
      await supabase.from('edition_artists').insert({
        edition_id: editionId,
        artist_id: artistId,
        stage_id: form.stageId || null,
        day: form.day || null,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
      })
    }

    setForm({ artistName: '', stageId: '', day: '', startTime: '', endTime: '' })
    setShowForm(false)
    setSaving(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet artiste du lineup ?')) return
    await supabase.from('edition_artists').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const filtered = entries.filter(e =>
    !search || e.artist?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/festivals" className="p-2 text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Admin — Lineup</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter artiste
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ajouter un artiste</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm text-gray-400 mb-1">Nom de l'artiste *</label>
              <input
                value={form.artistName}
                onChange={e => setForm(p => ({ ...p, artistName: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                placeholder="Metallica"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Scène</label>
              <select
                value={form.stageId}
                onChange={e => setForm(p => ({ ...p, stageId: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-300 focus:outline-none focus:border-purple-500"
              >
                <option value="">Aucune</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Jour</label>
              <input
                type="date"
                value={form.day}
                onChange={e => setForm(p => ({ ...p, day: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-300 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Début</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-300 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fin</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                className="w-full px-3 py-2 bg-[#111] border border-[#333] rounded-lg text-gray-300 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ajouter
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-[#252525] text-gray-400 rounded-lg text-sm hover:bg-[#333]">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full max-w-sm px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Lineup table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {entries.length === 0 ? 'Aucun artiste. Importe via l\'écran édition ou ajoute manuellement.' : 'Aucun résultat.'}
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Artiste</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Scène</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Jour</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Horaire</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-[#1f1f1f] transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{e.artist?.name}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{e.stage?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {e.day ? new Date(e.day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {e.start_time ? `${e.start_time.slice(0, 5)}–${e.end_time?.slice(0, 5) ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
