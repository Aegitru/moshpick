'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Group, GroupMember, Edition } from '@/lib/types'

interface AppState {
  currentUser: User | null
  currentGroup: Group | null
  groupMembers: GroupMember[]
  selectedEditionId: string | null
  editions: Edition[]

  setCurrentUser: (user: User | null) => void
  setCurrentGroup: (group: Group | null) => void
  setGroupMembers: (members: GroupMember[]) => void
  setSelectedEditionId: (id: string | null) => void
  setEditions: (editions: Edition[]) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentGroup: null,
      groupMembers: [],
      selectedEditionId: null,
      editions: [],

      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentGroup: (group) => set({ currentGroup: group }),
      setGroupMembers: (members) => set({ groupMembers: members }),
      setSelectedEditionId: (id) => set({ selectedEditionId: id }),
      setEditions: (editions) => set({ editions }),
    }),
    {
      name: 'moshpick-store',
      partialize: (state) => ({ selectedEditionId: state.selectedEditionId }),
    }
  )
)
