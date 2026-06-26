import { cn, ratingColor } from '@/lib/utils'

interface RatingBadgeProps {
  rating: string
  alias?: string
  size?: 'sm' | 'md' | 'lg'
  isOwn?: boolean
}

export default function RatingBadge({ rating, alias, size = 'sm', isOwn = false }: RatingBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded font-mono font-bold',
      ratingColor(rating),
      size === 'sm' && 'px-1.5 py-0.5 text-xs',
      size === 'md' && 'px-2 py-1 text-sm',
      size === 'lg' && 'px-3 py-1.5 text-base',
      isOwn && 'ring-2 ring-white ring-offset-1 ring-offset-black'
    )}>
      {alias && <span className="opacity-70 text-xs">{alias}</span>}
      {rating}
    </span>
  )
}
