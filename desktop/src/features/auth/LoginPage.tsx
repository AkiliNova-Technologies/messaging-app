import { Eye, EyeOff, LockKeyhole, Server, Settings } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthState } from './authStore'

export function LoginPage({
  state,
  detail,
  onLogin,
  onSettings,
}: {
  state: AuthState
  detail: string
  onLogin: (u: string, p: string) => Promise<void>
  onSettings: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    void onLogin(username, password)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Sign in failed')
      })
      .finally(() => {
        setBusy(false)
      })
  }
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-600 text-white">
            <LockKeyhole />
          </span>
          <div>
            <h1 className="text-xl font-semibold">SecureLAN Messenger</h1>
            <p className="text-sm text-slate-500">
              Your organization’s private workspace
            </p>
          </div>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              required
              maxLength={100}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => {
                  setVisible((v) => !v)
                }}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between border-t pt-5 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Server size={16} />
            {state === 'SERVER_UNAVAILABLE'
              ? 'Server unavailable'
              : state === 'SESSION_EXPIRED'
                ? 'Session expired'
                : 'Ready to connect'}
          </span>
          <Button variant="ghost" size="sm" onClick={onSettings}>
            <Settings size={16} /> Server
          </Button>
        </div>
        {detail && <p className="mt-3 text-xs text-slate-500">{detail}</p>}
      </section>
    </main>
  )
}
