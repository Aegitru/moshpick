import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const RATINGS = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E+','E','E-'] as const
export type Rating = typeof RATINGS[number]

export function ratingColor(rating: string): string {
  const r = rating.charAt(0)
  if (r === 'A') return 'bg-emerald-500 text-white'
  if (r === 'B') return 'bg-blue-500 text-white'
  if (r === 'C') return 'bg-yellow-500 text-white'
  if (r === 'D') return 'bg-orange-500 text-white'
  return 'bg-red-500 text-white'
}

export function ratingBgLight(rating: string): string {
  const r = rating.charAt(0)
  if (r === 'A') return 'bg-emerald-100 text-emerald-800'
  if (r === 'B') return 'bg-blue-100 text-blue-800'
  if (r === 'C') return 'bg-yellow-100 text-yellow-800'
  if (r === 'D') return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function ratingBorderColor(rating: string): string {
  const r = rating.charAt(0)
  if (r === 'A') return 'border-emerald-500'
  if (r === 'B') return 'border-blue-500'
  if (r === 'C') return 'border-yellow-500'
  if (r === 'D') return 'border-orange-500'
  return 'border-red-500'
}

export function ratingNumeric(rating: string): number {
  const idx = RATINGS.indexOf(rating as Rating)
  return idx === -1 ? 999 : idx
}

export function bestRating(ratings: string[]): string | null {
  if (!ratings.length) return null
  return ratings.reduce((best, r) => ratingNumeric(r) < ratingNumeric(best) ? r : best, ratings[0])
}

export function normalizeArtistName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function formatTime(time: string | null): string {
  if (!time) return ''
  return time.slice(0, 5)
}

export function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
