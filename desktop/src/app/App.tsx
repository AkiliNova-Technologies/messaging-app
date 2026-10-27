/* eslint-disable react-hooks/exhaustive-deps */
import { X, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuthStore } from '@/features/auth/authStore'
import { AdminUsers } from '@/features/admin/AdminUsers'
import { MessagingWorkspace } from '@/features/messaging/components/MessagingWorkspace'
import { ConnectionCard } from '@/features/settings/ConnectionCard'
import {
  ApiError,
  api,
  login,
  logout,
  restore,
  retryRevocation,
  type User,
} from '@/lib/api/auth'
import { checkHealth } from '@/lib/api/health'
import { deploymentStatus, ensureBackendStarted } from '@/lib/api/deployment'
import {
  closeCache,
  openVerifiedCache,
  restoreOfflineCache,
} from '@/lib/storage/cache'
import { loadServerConnection } from '@/lib/storage/preferences'
import type { ServerConnection } from '@/types/connection'

export function App() {
  const auth = useAuthStore()
  const [settings, setSettings] = useState(false)
  const [dark, setDark] = useState(
    () => localStorage.getItem('securelan.theme') === 'dark',
  )
  const connection = loadServerConnection()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    void initialize()
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('securelan.theme', dark ? 'dark' : 'light')
  }, [dark])
  async function initialize() {
    const saved = loadServerConnection()
    if (!saved) {
      auth.set(
        'UNAUTHENTICATED',
        null,
        'Configure the local server before signing in.',
      )
      return
    }
    try {
      await deploymentStatus(saved)
      await ensureBackendStarted(saved)
      await checkHealth(saved)
    } catch (reason) {
      try {
        const offline = await restoreOfflineCache(saved)
        auth.set(
          'OFFLINE_AUTHENTICATED',
          offline.user,
          'Offline: showing previously synchronized messages.',
        )
      } catch (cacheError) {
        auth.set(
          'SERVER_UNAVAILABLE',
          null,
          `Offline cache unavailable: ${
            cacheError instanceof Error
              ? cacheError.message
              : 'no authorized encrypted cache'
          }. ${
            reason instanceof Error
              ? reason.message
              : 'Check the server connection and try again.'
          }`,
        )
      }
      return
    }
    try {
      await retryRevocation(saved)
    } catch {
      /* retry later */
    }
    try {
      const user = await restore(saved)
      await openVerifiedCache(saved, user)
      auth.set('AUTHENTICATED', user)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SESSION_EXPIRED')
        auth.set('SESSION_EXPIRED', null, 'Sign in again to continue.')
      else if (e instanceof Error && e.message === 'NO_SESSION')
        auth.set('UNAUTHENTICATED')
      else if (e instanceof Error && e.message === 'SERVER_UNAVAILABLE')
        auth.set(
          'SERVER_UNAVAILABLE',
          null,
          'Your saved session was preserved.',
        )
      else auth.set('UNAUTHENTICATED')
    }
  }
  async function signIn(username: string, password: string) {
    const saved = loadServerConnection()
    if (!saved) throw new Error('Configure a server first.')
    const result = await login(saved, username, password)
    await openVerifiedCache(saved, result.user)
    window.history.replaceState({}, '', '/')
    auth.set('AUTHENTICATED', result.user)
  }
  async function signOut() {
    if (connection) await logout(connection)
    await closeCache()
    auth.set('UNAUTHENTICATED')
  }
  if (auth.state === 'INITIALIZING')
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-violet-400" />
          <p>Restoring secure session…</p>
        </div>
      </main>
    )
  if (
    (auth.state !== 'AUTHENTICATED' &&
      auth.state !== 'OFFLINE_AUTHENTICATED') ||
    !auth.user
  )
    return (
      <>
        <LoginPage
          state={auth.state}
          detail={auth.detail}
          onLogin={signIn}
          onSettings={() => {
            setSettings(true)
          }}
        />
        {settings && (
          <SettingsModal
            close={() => {
              setSettings(false)
              void initialize()
            }}
          />
        )}
        <Toaster richColors />
      </>
    )
  return (
    <BrowserRouter>
      <div className="flex h-screen min-h-[600px] overflow-hidden bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <NavigationSidebar
          dark={dark}
          user={auth.user}
          onToggleTheme={() => {
            setDark((value) => !value)
          }}
          onOpenSettings={() => {
            setSettings(true)
          }}
          onSignOut={() => {
            void signOut()
          }}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                auth.state === 'AUTHENTICATED' &&
                auth.user.mustChangePassword &&
                connection ? (
                  <PasswordChange
                    connection={connection}
                    done={(user) => {
                      auth.set('AUTHENTICATED', user)
                    }}
                  />
                ) : (
                  <MessagingWorkspace current={auth.user} />
                )
              }
            />
            {auth.state === 'AUTHENTICATED' &&
              auth.user.role === 'ADMIN' &&
              connection && (
                <Route
                  path="/admin/users"
                  element={<AdminUsers connection={connection} />}
                />
              )}
            <Route path="/profile" element={<Profile user={auth.user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {settings && (
        <SettingsModal
          close={() => {
            setSettings(false)
          }}
        />
      )}
      <Toaster richColors />
    </BrowserRouter>
  )
}

function Profile({ user }: { user: User }) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((value) => value[0])
    .join('')
    .toUpperCase()
  return (
    <section className="h-full overflow-y-auto bg-slate-50/70 p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-bold">My profile</h1>
        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              {initials}
            </span>
            <div>
              <h2 className="font-semibold">{user.displayName}</h2>
              <p className="text-sm text-slate-500">@{user.username}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-6 text-sm dark:border-slate-800 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1 font-medium">{user.role}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Account status</dt>
              <dd className="mt-1 font-medium">{user.status}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
function SettingsModal({ close }: { close: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button className="absolute inset-0" aria-label="Close" onClick={close} />
      <div className="relative z-10 w-full max-w-xl">
        <button
          className="absolute right-4 top-4 z-20"
          aria-label="Close"
          onClick={close}
        >
          <X />
        </button>
        <ConnectionCard />
      </div>
    </div>
  )
}

function PasswordChange({
  connection,
  done,
}: {
  connection: ServerConnection
  done: (user: Awaited<ReturnType<typeof restore>>) => void
}) {
  const [error, setError] = useState('')
  function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void api(connection, 'POST', '/api/v1/auth/change-password', {
      currentPassword: data.get('current'),
      newPassword: data.get('next'),
    })
      .then(async () => {
        done(await restore(connection))
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : 'Password change failed',
        )
      })
  }
  return (
    <section className="grid min-h-full place-items-center p-8">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl border p-6"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-semibold">Change temporary password</h1>
        <p className="text-sm text-slate-500">
          Choose a new passphrase before continuing.
        </p>
        <input
          className="h-10 w-full rounded-lg border bg-transparent px-3"
          name="current"
          type="password"
          autoComplete="current-password"
          placeholder="Temporary password"
          required
        />
        <input
          className="h-10 w-full rounded-lg border bg-transparent px-3"
          name="next"
          type="password"
          autoComplete="new-password"
          placeholder="New passphrase (12+ characters)"
          minLength={12}
          required
        />
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        <Button className="w-full">Change password</Button>
      </form>
    </section>
  )
}
