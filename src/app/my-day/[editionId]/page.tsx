'use client'
import { use, useEffect, useState } from 'react'
import { Plus, X, Loader2, Pin } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { cn, ratingColor, formatTime } from '@/lib/utils'
import type { UserActivityBlock } from '@/lib/types'

const EMOJIS = ['🎵', '🍺', '🍕', '🚶', '🧘', '😴', '🚗', '🎪', '🌿', '📸', '👯', '🎉', '🛒', '🚿', '🎨']

interface TimelineItem {
  type: 'concert' | 'activity'
  id: string
  startTime: string
  endTime: string
  label: string
  emoji?: string
  artistId?: string
  ratings?: Record<string, string>
}

export default function MyDayPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params)
  const { currentUser, groupMembers } = useAppStore()
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('🎵')
  const [newStart, setNewStart] = useState('12:00')
  const [newEnd, setNewEnd] = useState('13:00')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadDays()
  }, [editionId])

  useEffect(() => {
    if (selectedDay) loadDay(selectedDay)
  }, [selectedDay])

  async function loadDays() {
    const { data } = await supabase
      .from('edition_artists')
      .select('day')
      .eq('edition_id', editionId)
      .not('day', 'is', null)
    const uniqueDays = [...new Set((data ?? []).map((d: any) => d.day))].sort()
    setDays(uniqueDays)
    setSelectedDay(uniqueDays[0] ?? null)
  }

  async function loadDay(day: string) {
    setLoading(true)
    if (!currentUser) { setLoading(false); return }

    // Load pinned concerts for this day
    const { data: picks } = await supabase
      .from('user_concert_picks')
      .select('edition_artist_id, edition_artists(id, artist_id, start_time, end_time, artists(name))')
      .eq('user_id', currentUser.id)

    const pinnedForDay = (picks ?? []).filter((p: any) => {
      // We need to filter by day
      return true // simplified - will load all
    })

    // Load concerts for this day + edition
    const { data: concertsForDay } = await supabase
      .from('edition_artists')
      .select('id, artist_id, start_time, end_time, artists(name)')
      .eq('edition_id', editionId)
      .eq('day', day)
      .not('start_time', 'is', null)

    const pinnedIds = new Set((picks ?? []).map((p: any) => p.edition_artist_id))
    const pinnedConcerts = (concertsForDay ?? []).filter((c: any) => pinnedIds.has(c.id))

    // Load artist ratings
    const artistIds = pinnedConcerts.map((c: any) => c.artist_id)
    const { data: ratingsData } = artistIds.length > 0
      ? await supabase.from('ratings').select('user_id, artist_id, rating').in('artist_id', artistIds)
      : { data: [] }
    const rMap: Record<string, Record<string, string>> = {}
    for (const r of ratingsData ?? []) {
      if (!rMap[r.artist_id]) rMap[r.artist_id] = {}
      rMap[r.artist_id][r.user_id] = r.rating
    }

    // Load activity blocks
    const { data: activities } = await supabase
      .from('user_activity_blocks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('edition_id', editionId)
      .eq('day', day)
      .order('start_time')

    const concertItems: TimelineItem[] = pinnedConcerts.map((c: any) => ({
      type: 'concert' as const,
      id: c.id,
      startTime: c.start_time,
      endTime: c.end_time,
      label: c.artists?.name ?? '',
      artistId: c.artist_id,
      ratings: rMap[c.artist_id] ?? {},
    }))

    const activityItems: TimelineItem[] = (activities ?? []).map((a: UserActivityBlock) => ({
      type: 'activity' as const,
      id: a.id,
      startTime: a.start_time,
      endTime: a.end_time,
      label: a.label,
      emoji: a.emoji ?? undefined,
    }))

    const all = [...concertItems, ...activityItems].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )

    setItems(all)
    setLoading(false)
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser || !selectedDay) return
    setSaving(true)

    await supabase.from('user_activity_blocks').insert({
      user_id: currentUser.id,
      edition_id: editionId,
      day: selectedDay,
      start_time: newStart,
      end_time: newEnd,
      emoji: newEmoji,
      label: newLabel,
    })

    setSaving(false)
    setShowModal(false)
    setNewLabel('')
    loadDay(selectedDay)
  }

  async function handleDeleteActivity(id: string) {
    await supabase.from('user_activity_blocks').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const members = groupMembers.filter(m => m.user)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Ma Journée</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Activité
        </button>
      </div>

      {/* Day tabs */}
      {days.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', d === selectedDay ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:border-purple-500')}
            >
              {new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Pin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Aucun concert épinglé ni activité.</p>
          <p className="text-gray-600 text-sm mt-2">Épingle des concerts dans le Planning ou ajoute une activité.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl border',
                item.type === 'concert' ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-[#161616] border-[#252525]'
              )}
            >
              <div className="text-center flex-shrink-0 w-14">
                <p className="text-xs text-purple-400 font-mono">{formatTime(item.startTime)}</p>
                <p className="text-xs text-gray-600">→</p>
                <p className="text-xs text-gray-500 font-mono">{formatTime(item.endTime)}</p>
              </div>

              <div className="flex-1 min-w-0">
                {item.type === 'concert' ? (
                  <>
                    <Link href={`/artist/${item.artistId}`} className="font-semibold text-white hover:text-purple-400 transition-colors">
                      🎤 {item.label}
                    </Link>
                    {item.ratings && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {members.map(m => {
                          const r = item.ratings![m.user_id]
                          if (!r) return null
                          return (
                            <span key={m.user_id} className={cn('px-1.5 py-0.5 rounded text-xs font-mono font-bold', ratingColor(r))}>
                              {(m.user as any)?.alias} {r}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-white">
                    {item.emoji} {item.label}
                  </p>
                )}
              </div>

              {item.type === 'activity' && (
                <button onClick={() => handleDeleteActivity(item.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add activity modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Ajouter une activité</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNewEmoji(e)}
                      className={cn('w-9 h-9 rounded-lg text-lg transition-colors', newEmoji === e ? 'bg-purple-600' : 'bg-[#252525] hover:bg-[#333]')}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  required
                  placeholder="Ex: Repas, Navette, Sieste..."
                  className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Début</label>
                  <input
                    type="time"
                    value={newStart}
                    onChange={e => setNewStart(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Fin</label>
                  <input
                    type="time"
                    value={newEnd}
                    onChange={e => setNewEnd(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ajouter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
