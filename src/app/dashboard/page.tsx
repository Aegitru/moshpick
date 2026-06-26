'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Music2, Calendar, ChevronRight, Loader2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { ratingNumeric } from '@/lib/utils'

interface MemberProgress {
  userId: string
  name: string
  alias: string
  rated: number
  total: number
}

export default function DashboardPage() {
  const { currentUser, currentGroup, groupMembers, selectedEditionId, editions, setSelectedEditionId } = useAppStore()
  const [progress, setProgress] = useState<MemberProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [editionName, setEditionName] = useState('')
  const supabase = createClient()

  const selectedEdition = editions.find(e => e.id === selectedEditionId)

  useEffect(() => {
    if (selectedEditionId) {
      loadProgress()
    } else {
      setLoading(false)
    }
  }, [selectedEditionId, groupMembers])

  useEffect(() => {
    if (selectedEdition) {
      const fest = (selectedEdition as any).festival?.name ?? 'Festival'
      setEditionName(`${fest} ${selectedEdition.year}`)
    }
  }, [selectedEdition])

  async function loadProgress() {
    setLoading(true)
    const { count: total } = await supabase
      .from('edition_artists')
      .select('*', { count: 'exact', head: true })
      .eq('edition_id', selectedEditionId!)

    const members = groupMembers.filter(m => m.user)

    const progressData: MemberProgress[] = await Promise.all(
      members.map(async (m) => {
        const { data: artistIds } = await supabase
          .from('edition_artists')
          .select('artist_id')
          .eq('edition_id', selectedEditionId!)

        const ids = artistIds?.map(a => a.artist_id) ?? []

        const { count: rated } = ids.length > 0
          ? await supabase
              .from('ratings')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', m.user_id)
              .in('artist_id', ids)
          : { count: 0 }

        return {
          userId: m.user_id,
          name: (m.user as any)?.name ?? m.user_id,
          alias: (m.user as any)?.alias ?? '???',
          rated: rated ?? 0,
          total: total ?? 0,
        }
      })
    )

    setProgress(progressData)
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
        {currentGroup && (
          <p className="text-gray-500">Groupe: <span className="text-purple-400">{currentGroup.name}</span></p>
        )}
      </div>

      {!currentGroup ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Pas encore dans un groupe</h2>
          <p className="text-gray-500 mb-6">Rejoins ou crée un groupe pour commencer à noter des artistes.</p>
          <Link href="/group" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
            Gérer mon groupe
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : editions.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center">
          <Music2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Aucune édition disponible</h2>
          <p className="text-gray-500 mb-6">Ajoute un festival via le panneau admin.</p>
          <Link href="/admin/festivals" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
            Admin Festivals
          </Link>
        </div>
      ) : (
        <>
          {/* Edition selector */}
          {editions.length > 1 && (
            <div className="mb-6 flex gap-2 flex-wrap">
              {editions.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEditionId(e.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    e.id === selectedEditionId
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:border-purple-500'
                  }`}
                >
                  {(e as any).festival?.name} {e.year}
                </button>
              ))}
            </div>
          )}

          {/* Current edition */}
          {selectedEdition && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-1">{editionName}</h2>
              {selectedEdition.start_date && (
                <p className="text-gray-500 text-sm">
                  {new Date(selectedEdition.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {selectedEdition.end_date && ` → ${new Date(selectedEdition.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </p>
              )}
            </div>
          )}

          {/* Progress per member */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Progression des notations</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : progress.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucun membre dans le groupe.</p>
            ) : (
              <div className="space-y-4">
                {progress.map(p => (
                  <div key={p.userId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {p.alias}
                        </span>
                        <span className="text-sm font-medium text-gray-300">{p.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">{p.rated}/{p.total} notés</span>
                    </div>
                    <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all"
                        style={{ width: p.total > 0 ? `${(p.rated / p.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedEditionId && (
              <>
                <Link
                  href={`/lineup/${selectedEditionId}`}
                  className="flex items-center justify-between p-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl hover:border-purple-500 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Lineup</p>
                      <p className="text-xs text-gray-500">Voir et noter les artistes</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </Link>

                <Link
                  href={`/planning/${selectedEditionId}`}
                  className="flex items-center justify-between p-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl hover:border-purple-500 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Planning</p>
                      <p className="text-xs text-gray-500">Grille horaire des concerts</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
