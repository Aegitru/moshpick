'use client'
import { useEffect, useState } from 'react'
import { Copy, Check, Loader2, Plus, Users, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { generateInviteCode } from '@/lib/utils'
import type { Group, GroupMember } from '@/lib/types'

export default function GroupPage() {
  const { currentUser, currentGroup, groupMembers, setCurrentGroup, setGroupMembers } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const supabase = createClient()

  async function copyCode() {
    if (!currentGroup) return
    await navigator.clipboard.writeText(currentGroup.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinLoading(true)
    setJoinError(null)

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase().trim())
      .single()

    if (groupError || !groupData) {
      setJoinError('Code invalide. Vérifie le code et réessaie.')
      setJoinLoading(false)
      return
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: groupData.id,
      user_id: currentUser!.id,
      role: 'member',
    })

    if (error) {
      setJoinError(error.code === '23505' ? 'Tu es déjà dans ce groupe.' : error.message)
      setJoinLoading(false)
      return
    }

    setCurrentGroup(groupData as Group)
    // Reload members
    const { data: members } = await supabase
      .from('group_members')
      .select('*, users(id, name, alias, email)')
      .eq('group_id', groupData.id)
    setGroupMembers((members ?? []) as GroupMember[])
    setJoinLoading(false)
    setInviteCode('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUser) return
    setCreateLoading(true)
    setCreateError(null)

    const code = generateInviteCode()
    const { data: groupData, error } = await supabase
      .from('groups')
      .insert({ name: createName, invite_code: code, created_by: currentUser.id })
      .select()
      .single()

    if (error || !groupData) {
      setCreateError(error?.message ?? 'Erreur lors de la création.')
      setCreateLoading(false)
      return
    }

    await supabase.from('group_members').insert({
      group_id: groupData.id,
      user_id: currentUser.id,
      role: 'admin',
    })

    setCurrentGroup(groupData as Group)
    const { data: members } = await supabase
      .from('group_members')
      .select('*, users(id, name, alias, email)')
      .eq('group_id', groupData.id)
    setGroupMembers((members ?? []) as GroupMember[])
    setCreateLoading(false)
  }

  async function handleLeave() {
    if (!currentUser || !currentGroup) return
    if (!confirm('Quitter ce groupe ?')) return
    await supabase.from('group_members')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('group_id', currentGroup.id)
    setCurrentGroup(null)
    setGroupMembers([])
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Mon Groupe</h1>

      {currentGroup ? (
        <>
          {/* Group info */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{currentGroup.name}</h2>
                <p className="text-sm text-gray-500">Code d'invitation</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-mono text-2xl font-bold text-purple-400 tracking-widest">
                    {currentGroup.invite_code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 text-gray-500 hover:text-white transition-colors"
                    title="Copier le code"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleLeave} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                Quitter
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Membres ({groupMembers.length})
            </h3>
            <div className="space-y-3">
              {groupMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-400">
                    {(m.user as any)?.alias ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{(m.user as any)?.name ?? m.user_id}</p>
                    <p className="text-xs text-gray-500">{(m.user as any)?.email}</p>
                  </div>
                  {m.role === 'admin' && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">Admin</span>
                  )}
                  {m.user_id === currentUser?.id && (
                    <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">Toi</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* No group - create or join */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-white mb-4">Rejoindre un groupe</h2>
            {joinError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {joinError}
              </div>
            )}
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Code d'invitation (8 caractères)"
                maxLength={8}
                required
                className="flex-1 px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono uppercase"
              />
              <button
                type="submit"
                disabled={joinLoading}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rejoindre'}
              </button>
            </form>
          </div>

          <div className="text-center text-gray-600 my-4">ou</div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Créer un groupe</h2>
            {createError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Nom du groupe"
                required
                className="flex-1 px-4 py-2.5 bg-[#111] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Créer</>}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
