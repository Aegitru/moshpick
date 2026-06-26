'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Loader2, Edit2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Festival } from '@/lib/types'

export default function AdminFestivalsPage() {
  const [festivals, setFestivals] = useState<Festival[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', location: '', website: '', clashfinder_prefix: '' })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadFestivals() }, [])

  async function loadFestivals() {
    setLoading(true)
    const { data } = await supabase.from('festivals').select('*').order('name')
    setFestivals((data ?? []) as Festival[])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (editId) {
      await supabase.from('festivals').update(form).eq('id', editId)
    } else {
      await supabase.from('festivals').insert(form)
    }
    setSaving(false)
    setShowForm(false)
    setEditId(null)
    setForm({ name: '', location: '', website: '', clashfinder_prefix: '' })
    loadFestivals()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce festival et toutes ses éditions ?')) return
    await supabase.from('festivals').delete().eq('id', id)
    setFestivals(prev => prev.filter(f => f.id !== id))
  }

  function startEdit(f: Festival) {
    setForm({ name: f.name, location: f.location ?? '', website: f.website ?? '', clashfinder_prefix: f.clashfinder_prefix ?? '' })
    setEditId(f.id)
    setShowForm(true)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin — Festivals</h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', location: '', website: '', clashfinder_prefix: '' }) }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau festival
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">{editId ? 'Modifier le festival' : 'Créer un festival'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nom *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  placeholder="Hellfest"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Lieu</label>
                <input
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  placeholder="Clisson, France"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Site web</label>
                <input
                  value={form.website}
                  onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Préfixe Clashfinder</label>
                <input
                  value={form.clashfinder_prefix}
                  onChange={e => setForm(p => ({ ...p, clashfinder_prefix: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                  placeholder="hf"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? 'Sauvegarder' : 'Créer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-[#252525] text-gray-400 rounded-lg hover:bg-[#333] transition-colors">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Festival list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : festivals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Aucun festival. Créez-en un ci-dessus.</div>
      ) : (
        <div className="space-y-3">
          {festivals.map(f => (
            <div key={f.id} className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
              <div className="flex-1">
                <h3 className="font-semibold text-white">{f.name}</h3>
                <p className="text-sm text-gray-500">{f.location}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(f)} className="p-2 text-gray-500 hover:text-white transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(f.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  href={`/admin/festivals/${f.id}/editions`}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#252525] hover:bg-[#333] text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Éditions <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
