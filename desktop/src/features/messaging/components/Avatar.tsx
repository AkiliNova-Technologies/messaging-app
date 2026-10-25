import { cn } from '@/lib/utils'
import type { Employee } from '@/features/messaging/types/messaging'

export function Avatar({
  employee,
  size = 'md',
  showPresence = false,
}: {
  employee: Employee
  size?: 'sm' | 'md' | 'lg'
  showPresence?: boolean
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          'grid place-items-center rounded-full font-semibold',
          employee.avatarClass,
          size === 'sm' && 'h-8 w-8 text-[10px]',
          size === 'md' && 'h-10 w-10 text-xs',
          size === 'lg' && 'h-20 w-20 text-lg',
        )}
        aria-label={`${employee.name} avatar`}
      >
        {employee.initials}
      </div>
      {showPresence && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900',
            employee.presence === 'online'
              ? 'bg-emerald-500'
              : employee.presence === 'away'
                ? 'bg-amber-400'
                : 'bg-slate-400',
          )}
          aria-label={employee.presence}
        />
      )}
    </div>
  )
}
