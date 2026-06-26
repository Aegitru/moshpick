'use client'
import { use, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Search, Star, Pin, Loader2, X, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { cn, RATINGS, ratingColor, ratingNumeric } from '@/lib/utils'
import RatingBadge from '@/components/RatingBadge'
import RatingPicker from '@/components/RatingPicker'
import type { Artist, Stage } from '@/lib/types'

interface ArtistRow {
  editionArtistId: string
  artistId: string
  name: string
  genres: string[]
  day: string | null
  stage: string | null
  startTime: string | null
  endTime: string | null
  ratings: Record<string, string> // userId -> rating
}

export default function LineupPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params)
  const { currentUser, groupMembers } = useAppStore()
  const [artists, setArtists] = useState<ArtistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [showUnrated, setShowUnrated] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [ratingPopup, setRatingPopup] = useState<string | null>(null) // editionArtistId
  const [ratingLoading, setRatingLoading] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadLineup()
  }, [editionId])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setRatingPopup(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadLineup() {
    setLoading(true)
    const { data: eas } = await supabase
      .from('edition_artists')
      .select('id, artist_id, stage_id, day, start_time, end_time, artists(id, name, genres), stages(id, name)')
      .eq('edition_id', editionId)
      .order('start_time', { ascending: true })

    const { data: stagesData } = await supabase
      .from('stages')
      .select('*')
      .eq('edition_id', editionId)
      .order('order', { ascending: true })

    const artistIds = eas?.map(ea => ea.artist_id) ?? []
    const { data: ratingsData } = artistIds.length > 0
      ? await supabase.from('ratings').select('user_id, artist_id, rating').in('artist_id', artistIds)
      : { data: [] }

    const ratingMap: Record<string, Record<string, string>> = {}
    for (const r of ratingsData ?? []) {
      if (!ratingMap[r.artist_id]) ratingMap[r.artist_id] = {}
      ratingMap[r.artist_id][r.user_id] = r.rating
    }

    const rows: ArtistRow[] = (eas ?? []).map(ea => ({
      editionArtistId: ea.id,
      artistId: ea.artist_id,
      name: (ea.artists as any)?.name ?? '',
      genres: (ea.artists as any)?.genres ?? [],
      day: ea.day,
      stage: (ea.stages as any)?.name ?? null,
      startTime: ea.start_time,
      endTime: ea.end_time,
      ratings: ratingMap[ea.artist_id] ?? {},
    }))

    const uniqueDays = [...new Set(rows.map(r => r.day).filter(Boolean) as string[])].sort()
    setDays(uniqueDays)
    setStages(stagesData ?? [])
    setArtists(rows)
    setLoading(false)
  }

  async function handleRate(artistId: string, rating: string) {
    if (!currentUser) return
    setRatingLoading(artistId)
    await supabase.from('ratings').upsert({
      user_id: currentUser.id,
      artist_id: artistId,
      rating,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,artist_id' })

    setArtists(prev => prev.map(a =>
      a.artistId === artistId
        ? { ...a, ratings: { ...a.ratings, [currentUser.id]: rating } }
        : a
    ))
    setRatingLoading(null)
    setRatingPopup(null)
  }

  const members = groupMembers.filter(m => m.user)

  const filtered = artists
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedDay && a.day !== selectedDay) return false
      if (selectedStage && a.stage !== selectedStage) return false
      if (showUnrated && currentUser && a.ratings[currentUser.id]) return false
      return true
    })
    .sort((a, b) => {
      // unrated first
      const aRated = currentUser ? !!a.ratings[currentUser.id] : false
      const bRated = currentUser ? !!b.ratings[currentUser.id] : false
      if (aRated !== bRated) return aRated ? 1 : -1
      // then by current user rating
      const aR = currentUser ? ratingNumeric(a.ratings[currentUser.id] ?? '') : 999
      const bR = currentUser ? ratingNumeric(b.ratings[currentUser.id] ?? '') : 999
      return aR - bR
    })

  const totalRated = currentUser ? artists.filter(a => a.ratings[currentUser.id]).length : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lineup</h1>
          <p className="text-sm text-gray-500">{totalRated}/{artists.length} notés</p>
        </div>
        <div className="h-2 w-32 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all"
            style={{ width: artists.length > 0 ? `${(totalRated / artists.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un artiste..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Day filter */}
        {days.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedDay(null)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', !selectedDay ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:border-purple-500')}
            >
              Tous
            </button>
            {days.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(d === selectedDay ? null : d)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', d === selectedDay ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:border-purple-500')}
              >
                {new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
        )}

        {/* Stage + unrated toggle */}
        <div className="flex gap-3 flex-wrap items-center">
          {stages.length > 0 && (
            <select
              value={selectedStage ?? ''}
              onChange={e => setSelectedStage(e.target.value || null)}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Toutes les scènes</option>
              {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowUnrated(!showUnrated)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border', showUnrated ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-purple-500')}
          >
            <Filter className="w-3 h-3" />
            Non notés seulement
          </button>
        </div>
      </div>

      {/* Artist list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {artists.length === 0 ? 'Aucun artiste dans cette édition. Importe le lineup via Admin.' : 'Aucun artiste trouvé.'}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(a => {
            const myRating = currentUser ? a.ratings[currentUser.id] : null
            const isOpen = ratingPopup === a.editionArtistId

            return (
              <div
                key={a.editionArtistId}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  myRating ? 'bg-[#161616] border-[#222]' : 'bg-[#1a1a1a] border-[#2a2a2a]'
                )}
              >
                {/* Artist info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/artist/${a.artistId}`} className="font-medium text-white hover:text-purple-400 transition-colors truncate block">
                    {a.name}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {a.stage && <span>{a.stage}</span>}
                    {a.startTime && <span>· {a.startTime.slice(0, 5)}</span>}
                    {a.genres.length > 0 && <span className="hidden sm:inline">· {a.genres.slice(0, 2).join(', ')}</span>}
                  </div>
                </div>

                {/* Group ratings */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {members.map(m => {
                    const r = a.ratings[m.user_id]
                    const isMe = currentUser?.id === m.user_id
                    if (!r) return isMe ? null : <span key={m.user_id} className="w-6 h-6 rounded bg-[#252525] border border-[#333] text-gray-600 flex items-center justify-center text-xs">{(m.user as any)?.alias ?? '?'}</span>
                    return <RatingBadge key={m.user_id} rating={r} alias={(m.user as any)?.alias} isOwn={isMe} />
                  })}
                </div>

                {/* Rate button */}
                <div className="relative flex-shrink-0" ref={isOpen ? popupRef : undefined}>
                  <button
                    onClick={() => setRatingPopup(isOpen ? null : a.editionArtistId)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      myRating ? ratingColor(myRating) : 'bg-[#252525] text-gray-400 hover:bg-purple-600 hover:text-white'
                    )}
                    disabled={ratingLoading === a.artistId}
                  >
                    {ratingLoading === a.artistId ? <Loader2 className="w-3 h-3 animate-spin" /> : myRating ?? '·'}
                  </button>
                  {isOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50">
                      <RatingPicker
                        current={myRating}
                        onSelect={(r) => handleRate(a.artistId, r)}
                        onClose={() => setRatingPopup(null)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
