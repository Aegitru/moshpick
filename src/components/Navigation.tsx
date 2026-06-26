'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Music2, Calendar, Map, Users, Settings, LogOut, ChevronDown, Menu, X, Skull } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Edition } from '@/lib/types'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentUser, currentGroup, selectedEditionId, setSelectedEditionId, editions, setEditions, setCurrentUser, setCurrentGroup, setGroupMembers } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [editionOpen, setEditionOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!currentUser) return
    loadEditions()
  }, [currentUser, currentGroup])

  async function loadEditions() {
    if (!currentGroup) return
    const { data } = await supabase
      .from('group_editions')
      .select('edition_id, editions(id, year, festival_id, festivals(name))')
      .eq('group_id', currentGroup.id)
    if (data && data.length > 0) {
      const eds = data.map((ge: any) => ge.editions).filter(Boolean) as Edition[]
      setEditions(eds)
      if (!selectedEditionId && eds.length > 0) {
        setSelectedEditionId(eds[0].id)
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setCurrentGroup(null)
    setGroupMembers([])
    router.push('/login')
  }

  const selectedEdition = editions.find(e => e.id === selectedEditionId)

  const isAdmin = currentGroup && currentUser
    ? true // simplified: all users have admin access for MVP
    : false

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Music2 },
    { href: selectedEditionId ? `/lineup/${selectedEditionId}` : '/dashboard', label: 'Lineup', icon: Music2 },
    { href: selectedEditionId ? `/planning/${selectedEditionId}` : '/dashboard', label: 'Planning', icon: Calendar },
    { href: selectedEditionId ? `/my-day/${selectedEditionId}` : '/dashboard', label: 'Ma Journée', icon: Map },
    { href: '/group', label: 'Groupe', icon: Users },
  ]

  if (!currentUser) return null

  return (
    <nav className="sticky top-0 z-50 bg-[#111] border-b border-[#2a2a2a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-white">
            <Skull className="w-5 h-5 text-purple-500" />
            <span className="text-purple-400">Mosh</span>Pick
          </Link>

          {/* Edition selector */}
          {editions.length > 0 && (
            <div className="relative hidden md:block">
              <button
                onClick={() => setEditionOpen(!editionOpen)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-gray-300 hover:border-purple-500 transition-colors"
              >
                <span>{selectedEdition ? `${(selectedEdition as any).festival?.name ?? ''} ${selectedEdition.year}` : 'Choisir édition'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {editionOpen && (
                <div className="absolute top-full mt-1 left-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl min-w-48 z-50">
                  {editions.map(e => (
                    <button
                      key={e.id}
                      onClick={() => { setSelectedEditionId(e.id); setEditionOpen(false) }}
                      className={cn('w-full text-left px-4 py-2 text-sm hover:bg-[#252525] transition-colors', e.id === selectedEditionId && 'text-purple-400')}
                    >
                      {(e as any).festival?.name ?? ''} {e.year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href || pathname.startsWith(href.split('/').slice(0, 2).join('/') + '/')
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                )}
              >
                {label}
              </Link>
            ))}

            {/* Admin dropdown */}
            <div className="relative">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                <Settings className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {adminOpen && (
                <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl min-w-48 z-50">
                  <Link href="/admin/festivals" className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#252525] transition-colors" onClick={() => setAdminOpen(false)}>
                    Festivals
                  </Link>
                  {selectedEditionId && (
                    <Link href={`/admin/lineup/${selectedEditionId}`} className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#252525] transition-colors" onClick={() => setAdminOpen(false)}>
                      Gestion Lineup
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[#2a2a2a]">
              <span className="text-sm text-gray-400">{currentUser.name}</span>
              <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-400 hover:text-white">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#2a2a2a] bg-[#111]">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith(href) ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <Link href="/admin/festivals" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a]">
              <Settings className="w-4 h-4" />
              Admin
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-[#1a1a1a] w-full">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
