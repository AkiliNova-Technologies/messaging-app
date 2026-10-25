import {
  ContactRound,
  LogOut,
  MessageCircle,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { User } from '@/lib/api/auth'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  dark: boolean
  user: User
  onToggleTheme: () => void
  onOpenSettings: () => void
  onSignOut: () => void
}
export function NavigationSidebar({
  dark,
  user,
  onToggleTheme,
  onOpenSettings,
  onSignOut,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menu.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('mousedown', close)
    }
  }, [])
  const initials =
    user.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || user.username.slice(0, 2).toUpperCase()
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
      isActive &&
        'bg-violet-500/15 text-violet-300 before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-full before:bg-violet-400',
    )
  return (
    <aside className="z-50 flex w-16 shrink-0 flex-col items-center bg-[#202126] py-4 text-slate-400">
      <Tooltip label="SecureLAN Messenger">
        <NavLink
          to="/"
          className="mb-7 grid h-9 w-9 place-items-center rounded-xl bg-violet-500 text-white"
          aria-label="SecureLAN Messenger"
        >
          <ShieldCheck className="h-5 w-5" />
        </NavLink>
      </Tooltip>
      <nav
        className="flex flex-1 flex-col gap-2"
        aria-label="Primary navigation"
      >
        <Tooltip label="Messages">
          <NavLink end to="/" className={linkClass} aria-label="Messages">
            <MessageCircle className="h-[18px] w-[18px]" />
          </NavLink>
        </Tooltip>
        <Tooltip label="Contacts">
          <button
            disabled
            className="grid h-10 w-10 place-items-center rounded-xl opacity-50"
            aria-label="Contacts unavailable"
          >
            <ContactRound className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
        {user.role === 'ADMIN' && (
          <Tooltip label="User management">
            <NavLink
              to="/admin/users"
              className={linkClass}
              aria-label="User management"
            >
              <Users className="h-[18px] w-[18px]" />
            </NavLink>
          </Tooltip>
        )}
      </nav>
      <div className="flex flex-col items-center gap-2">
        <Tooltip label={dark ? 'Use light theme' : 'Use dark theme'}>
          <button
            onClick={onToggleTheme}
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 hover:text-white"
          >
            {dark ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
        </Tooltip>
        <Tooltip label="Connection settings">
          <button
            onClick={onOpenSettings}
            aria-label="Connection settings"
            className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
        <div ref={menu} className="relative mt-2">
          <button
            onClick={() => {
              setProfileOpen((value) => !value)
            }}
            aria-label={`Profile menu for ${user.displayName}`}
            aria-expanded={profileOpen}
            className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 ring-2 ring-white/10"
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="absolute bottom-0 left-12 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-2 text-left text-white shadow-2xl">
              <div className="border-b border-slate-700 px-3 py-2">
                <p className="truncate text-sm font-semibold">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-slate-400">
                  @{user.username}
                </p>
              </div>
              <NavLink
                to="/profile"
                onClick={() => {
                  setProfileOpen(false)
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-800"
              >
                <UserRound size={16} />
                My profile
              </NavLink>
              <button
                onClick={onOpenSettings}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-800"
              >
                <Settings size={16} />
                Settings
              </button>
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-slate-800"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
