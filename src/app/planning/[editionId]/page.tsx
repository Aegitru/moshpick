'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Pin, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { cn, ratingColor, ratingNumeric, bestRating } from '@/lib/utils'
import type { Stage } from '@/lib/types'

interface Block {
  id: string
  artistId: string
  artistName: string
  stageId: string | null
  stageName: string | null
  day: string
  startTime: string
  endTime: string
  ratings: Record<string, string>
  isPinned: boolean
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h < 6 ? (h + 24) * 60 + m : h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default function PlanningPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params)
  const { currentUser, groupMembers } = useAppStore()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [primaryOnly, setPrimaryOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [picks, setPicks] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    loadPlanning()
  }, [editionId])

  async function loadPlanning() {
    setLoading(true)
    const { data: eas } = await supabase
      .from('edition_artists')
      .select('id, artist_id, stage_id, day, start_time, end_time, artists(id, name), stages(id, name, is_primary)')
      .eq('edition_id', editionId)
      .not('start_time', 'is', null)
      .order('start_time')

    const artistIds = eas?.map(ea => ea.artist_id) ?? []
    const { data: ratingsData } = artistIds.length > 0
      ? await supabase.from('ratings').select('user_id, artist_id, rating').in('artist_id', artistIds)
      : { data: [] }

    const rMap: Record<string, Record<string, string>> = {}
    for (const r of ratingsData ?? []) {
      if (!rMap[r.artist_id]) rMap[r.artist_id] = {}
      rMap[r.artist_id][r.user_id] = r.rating
    }

    // Load picks
    if (currentUser) {
      const eaIds = eas?.map(ea => ea.id) ?? []
      const { data: picksData } = eaIds.length > 0
        ? await supabase.from('user_concert_picks').select('edition_artist_id').eq('user_id', currentUser.id).in('edition_artist_id', eaIds)
        : { data: [] }
      setPicks(new Set((picksData ?? []).map((p: any) => p.edition_artist_id)))
    }

    const { data: stagesData } = await supabase.from('stages').select('*').eq('edition_id', editionId).order('order')
    setStages(stagesData ?? [])

    const bArr: Block[] = (eas ?? [])
      .filter((ea: any) => ea.day && ea.start_time && ea.end_time)
      .map((ea: any) => ({
        id: ea.id,
        artistId: ea.artist_id,
        artistName: ea.artists?.name ?? '',
        stageId: ea.stage_id,
        stageName: ea.stages?.name ?? null,
        day: ea.day,
        startTime: ea.start_time,
        endTime: ea.end_time,
        ratings: rMap[ea.artist_id] ?? {},
        isPrimary: ea.stages?.is_primary ?? true,
        isPinned: false,
      }))

    const uniqueDays = [...new Set(bArr.map(b => b.day))].sort()
    setDays(uniqueDays)
    setSelectedDay(uniqueDays[0] ?? null)
    setBlocks(bArr)
    setLoading(false)
  }

  async function togglePin(eaId: string) {
    if (!currentUser) return
    if (picks.has(eaId)) {
      await supabase.from('user_concert_picks').delete().eq('user_id', currentUser.id).eq('edition_artist_id', eaId)
      setPicks(prev => { const n = new Set(prev); n.delete(eaId); return n })
    } else {
      await supabase.from('user_concert_picks').insert({ user_id: currentUser.id, edition_artist_id: eaId })
      setPicks(prev => new Set(prev).add(eaId))
    }
  }

  const displayedStages = stages.filter(s => !primaryOnly || s.is_primary)
  const dayBlocks = blocks.filter(b => b.day === selectedDay && (
    !primaryOnly || stages.find(s => s.id === b.stageId)?.is_primary !== false
  ))

  // Time range
  const startMinutes = dayBlocks.length > 0 ? Math.min(...dayBlocks.map(b => timeToMinutes(b.startTime))) : 10 * 60
  const endMinutes = dayBlocks.length > 0 ? Math.max(...dayBlocks.map(b => timeToMinutes(b.endTime))) : 26 * 60
  const HOUR_HEIGHT = 80 // px per hour
  const totalMinutes = endMinutes - startMinutes
  const totalHeight = (totalMinutes / 60) * HOUR_HEIGHT

  const hourMarkers: number[] = []
  for (let m = startMinutes - (startMinutes % 60); m <= endMinutes; m += 60) {
    hourMarkers.push(m)
  }

  const members = groupMembers.filter(m => m.user)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Planning</h1>
        <button
          onClick={() => setPrimaryOnly(!primaryOnly)}
          className={cn('px-3 py-1.5 rounded-lg text-sm border transition-colors', primaryOnly ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-[#2a2a2a] text-gray-400 hover:border-purple-500')}
        >
          {primaryOnly ? 'Scènes principales' : 'Toutes les scènes'}
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
      ) : dayBlocks.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun concert programmé pour ce jour.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Stage headers */}
            <div className="flex gap-0 ml-16 mb-2">
              {displayedStages.map(s => (
                <div key={s.id} className="w-44 px-2 text-center text-sm font-semibold text-gray-300 truncate">
                  {s.icon && <span className="mr-1">{s.icon}</span>}
                  {s.name}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0">
              {/* Time axis */}
              <div className="w-16 relative flex-shrink-0" style={{ height: totalHeight }}>
                {hourMarkers.map(m => {
                  const top = ((m - startMinutes) / 60) * HOUR_HEIGHT
                  return (
                    <div key={m} className="absolute left-0 right-0 text-xs text-gray-600" style={{ top }}>
                      {minutesToTime(m)}
                    </div>
                  )
                })}
              </div>

              {/* Stage columns */}
              {displayedStages.map(s => {
                const stageBlocks = dayBlocks.filter(b => b.stageId === s.id)
                return (
                  <div key={s.id} className="w-44 relative flex-shrink-0 border-l border-[#1a1a1a]" style={{ height: totalHeight }}>
                    {/* Hour lines */}
                    {hourMarkers.map(m => (
                      <div key={m} className="absolute left-0 right-0 border-t border-[#1a1a1a]" style={{ top: ((m - startMinutes) / 60) * HOUR_HEIGHT }} />
                    ))}

                    {stageBlocks.map(b => {
                      const top = ((timeToMinutes(b.startTime) - startMinutes) / 60) * HOUR_HEIGHT
                      const height = Math.max(((timeToMinutes(b.endTime) - timeToMinutes(b.startTime)) / 60) * HOUR_HEIGHT - 2, 24)
                      const groupRatings = members.map(m => b.ratings[m.user_id]).filter(Boolean)
                      const best = bestRating(groupRatings)
                      const isConflict = groupRatings.filter(r => r === 'A+' || r === 'A').length >= 2
                      const pinned = picks.has(b.id)

                      return (
                        <div
                          key={b.id}
                          className={cn(
                            'absolute left-1 right-1 rounded-lg p-1.5 overflow-hidden border cursor-pointer transition-colors hover:border-purple-500',
                            best ? 'border-[#333]' : 'border-[#2a2a2a] bg-[#1a1a1a]',
                            isConflict && 'border-orange-500'
                          )}
                          style={{
                            top,
                            height,
                            backgroundColor: best ? `${getBgColor(best)}` : undefined,
                          }}
                        >
                          <Link href={`/artist/${b.artistId}`} className="block">
                            <p className="text-xs font-semibold text-white truncate leading-tight">{b.artistName}</p>
                            <p className="text-xs text-gray-400">{b.startTime.slice(0, 5)}</p>
                          </Link>
                          <div className="flex items-center justify-between mt-0.5">
                            <div className="flex gap-0.5">
                              {members.map(m => {
                                const r = b.ratings[m.user_id]
                                if (!r) return null
                                return (
                                  <span key={m.user_id} className={cn('text-xs px-0.5 rounded font-mono font-bold', ratingColor(r))}>
                                    {r}
                                  </span>
                                )
                              })}
                            </div>
                            <button
                              onClick={(e) => { e.preventDefault(); togglePin(b.id) }}
                              className={cn('p-0.5 rounded transition-colors', pinned ? 'text-purple-400' : 'text-gray-600 hover:text-purple-400')}
                            >
                              <Pin className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getBgColor(rating: string): string {
  const r = rating.charAt(0)
  if (r === 'A') return '#064e3b33'
  if (r === 'B') return '#1e3a5f33'
  if (r === 'C') return '#78350f33'
  if (r === 'D') return '#7c2d1233'
  return '#450a0a33'
}
