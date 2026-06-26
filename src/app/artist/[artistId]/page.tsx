'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe, Loader2, Music2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { cn, ratingColor, formatTime } from '@/lib/utils'
import RatingBadge from '@/components/RatingBadge'
import RatingPicker from '@/components/RatingPicker'
import type { Artist, ConcertStatus } from '@/lib/types'

const CONCERT_STATUSES: { value: ConcertStatus; label: string; icon: string }[] = [
  { value: 'seen', label: 'Vu', icon: '👁️' },
  { value: 'partially_seen', label: 'En partie', icon: '👀' },
  { value: 'liked', label: 'Adoré', icon: '🤘' },
  { value: 'disliked', label: 'Pas aimé', icon: '👎' },
]

export default function ArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = use(params)
  const { currentUser, groupMembers, selectedEditionId } = useAppStore()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [ratings, setRatings] = useState<Record<string, string>>({})
  const [appearances, setAppearances] = useState<any[]>([])
  const [concertReview, setConcertReview] = useState<ConcertStatus | null>(null)
  const [currentEditionArtistId, setCurrentEditionArtistId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadArtist()
  }, [artistId])

  async function loadArtist() {
    setLoading(true)
    const { data: artistData } = await supabase.from('artists').select('*').eq('id', artistId).single()
    if (!artistData) { setLoading(false); return }
    setArtist(artistData as Artist)

    // Load all ratings for this artist
    const { data: ratingsData } = await supabase.from('ratings').select('user_id, rating').eq('artist_id', artistId)
    const rMap: Record<string, string> = {}
    for (const r of ratingsData ?? []) rMap[r.user_id] = r.rating
    setRatings(rMap)

    // Load all appearances
    const { data: eaData } = await supabase
      .from('edition_artists')
      .select('id, day, start_time, end_time, edition_id, stage_id, editions(year, festival_id, festivals(name)), stages(name)')
      .eq('artist_id', artistId)
      .order('day', { ascending: false })
    setAppearances(eaData ?? [])

    // Find current edition's edition_artist
    if (selectedEditionId && eaData) {
      const curr = eaData.find((ea: any) => ea.edition_id === selectedEditionId)
      if (curr) {
        setCurrentEditionArtistId(curr.id)
        // Load concert review
        if (currentUser) {
          const { data: review } = await supabase
            .from('concert_reviews')
            .select('status')
            .eq('user_id', currentUser.id)
            .eq('edition_artist_id', curr.id)
            .single()
          if (review) setConcertReview(review.status as ConcertStatus)
        }
      }
    }

    setLoading(false)
  }

  async function handleRate(rating: string) {
    if (!currentUser || !artist) return
    await supabase.from('ratings').upsert({
      user_id: currentUser.id,
      artist_id: artistId,
      rating,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,artist_id' })
    setRatings(prev => ({ ...prev, [currentUser.id]: rating }))
    setShowPicker(false)
  }

  async function handleReview(status: ConcertStatus) {
    if (!currentUser || !currentEditionArtistId) return
    const newStatus = concertReview === status ? null : status
    if (newStatus) {
      await supabase.from('concert_reviews').upsert({
        user_id: currentUser.id,
        edition_artist_id: currentEditionArtistId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,edition_artist_id' })
    } else {
      await supabase.from('concert_reviews').delete()
        .eq('user_id', currentUser.id)
        .eq('edition_artist_id', currentEditionArtistId)
    }
    setConcertReview(newStatus)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
        Artiste introuvable.
      </div>
    )
  }

  const myRating = currentUser ? ratings[currentUser.id] : null
  const members = groupMembers.filter(m => m.user)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      {/* Artist header */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{artist.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-4">
              {artist.country && <span>🌍 {artist.country}</span>}
              {artist.formed_year && <span>📅 {artist.formed_year}</span>}
              {artist.website && (
                <a href={artist.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
                  <Globe className="w-3 h-3" />
                  Site web
                </a>
              )}
            </div>
            {artist.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {artist.genres.map(g => (
                  <span key={g} className="px-2 py-0.5 bg-[#252525] rounded text-xs text-gray-400">{g}</span>
                ))}
              </div>
            )}
          </div>
          {artist.photo_url && (
            <img src={artist.photo_url} alt={artist.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Group ratings */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Notes du groupe</h2>
        <div className="flex flex-wrap gap-3">
          {members.map(m => {
            const r = ratings[m.user_id]
            const isMe = currentUser?.id === m.user_id
            return (
              <div key={m.user_id} className="flex flex-col items-center gap-1.5">
                <span className="text-xs text-gray-500">{(m.user as any)?.name}</span>
                {r ? (
                  <RatingBadge rating={r} size="md" isOwn={isMe} />
                ) : (
                  <span className="px-3 py-1 bg-[#252525] rounded text-sm text-gray-600">–</span>
                )}
              </div>
            )
          })}
        </div>

        {/* My rating picker */}
        <div className="mt-4 pt-4 border-t border-[#252525]">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Ma note :</span>
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className={cn(
                  'px-4 py-2 rounded-lg font-bold text-sm transition-colors',
                  myRating ? ratingColor(myRating) : 'bg-[#252525] text-gray-400 hover:bg-purple-600 hover:text-white'
                )}
              >
                {myRating ?? 'Noter'}
              </button>
              {showPicker && (
                <div className="absolute left-0 top-full mt-2 z-50">
                  <RatingPicker current={myRating} onSelect={handleRate} onClose={() => setShowPicker(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Concert review (if in current edition) */}
      {currentEditionArtistId && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Mon retour concert</h2>
          <div className="flex flex-wrap gap-2">
            {CONCERT_STATUSES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => handleReview(value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                  concertReview === value
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-[#252525] border-[#333] text-gray-400 hover:border-purple-500'
                )}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Streaming embed */}
      {artist.spotify_this_is_playlist_id && (
        <div className="mb-6">
          <iframe
            src={`https://open.spotify.com/embed/playlist/${artist.spotify_this_is_playlist_id}`}
            width="100%"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="rounded-xl"
          />
        </div>
      )}

      {/* Appearances */}
      {appearances.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Apparitions</h2>
          <div className="space-y-2">
            {appearances.map((ea: any) => (
              <div key={ea.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white font-medium">{ea.editions?.festivals?.name} {ea.editions?.year}</span>
                  {ea.stages?.name && <span className="text-gray-500 ml-2">· {ea.stages.name}</span>}
                </div>
                <div className="text-gray-500">
                  {ea.day && new Date(ea.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {ea.start_time && <span className="ml-2">{formatTime(ea.start_time)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
