import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10',
        variant === 'default' &&
          'bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:bg-violet-500 dark:text-white dark:hover:bg-violet-400',
        variant === 'outline' &&
          'border border-slate-300 bg-transparent text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800',
        variant === 'ghost' &&
          'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
        className,
      )}
      {...props}
    />
  )
}
