import type { ReactNode } from 'react'

export function Tooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="group relative flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white dark:text-slate-950"
      >
        {label}
      </span>
    </div>
  )
}
