'use client'
import { RATINGS, ratingColor, cn } from '@/lib/utils'

interface RatingPickerProps {
  current?: string | null
  onSelect: (rating: string) => void
  onClose?: () => void
}

export default function RatingPicker({ current, onSelect, onClose }: RatingPickerProps) {
  const groups = [
    RATINGS.slice(0, 3),
    RATINGS.slice(3, 6),
    RATINGS.slice(6, 9),
    RATINGS.slice(9, 12),
    RATINGS.slice(12, 15),
  ]

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl z-50">
      <div className="flex gap-1.5">
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {group.map(r => (
              <button
                key={r}
                onClick={() => { onSelect(r); onClose?.() }}
                className={cn(
                  'px-2.5 py-1 rounded font-mono font-bold text-xs transition-all hover:scale-110',
                  ratingColor(r),
                  current === r && 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1a1a] scale-110'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
