import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white/90 shadow-xl shadow-slate-950/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90',
        className,
      )}
      {...props}
    />
  )
}
