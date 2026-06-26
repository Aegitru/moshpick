'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import type { User, Group, GroupMember } from '@/lib/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setCurrentUser, setCurrentGroup, setGroupMembers } = useAppStore()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserData(session.user.id)
      } else {
        setCurrentUser(null)
        setCurrentGroup(null)
        setGroupMembers([])
      }
    })

    // Initial load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUserData(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserData(userId: string) {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userData) {
      setCurrentUser(userData as User)

      // Load group membership
      const { data: memberData } = await supabase
        .from('group_members')
        .select('*, groups(*)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single()

      if (memberData && (memberData as any).groups) {
        setCurrentGroup((memberData as any).groups as Group)

        // Load all group members
        const { data: allMembers } = await supabase
          .from('group_members')
          .select('*, users(id, name, alias, email)')
          .eq('group_id', (memberData as any).groups.id)

        if (allMembers) {
          setGroupMembers(allMembers as GroupMember[])
        }
      }
    }
  }

  return <>{children}</>
}
