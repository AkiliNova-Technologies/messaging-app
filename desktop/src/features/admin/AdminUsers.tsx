/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import {
  CircleEllipsis,
  KeyRound,
  Plus,
  Search,
  UserCheck,
  UserRound,
  UserX,
  X,
} from 'lucide-react'
import { useEffect, useState, type SyntheticEvent } from 'react'
import { api, type User } from '@/lib/api/auth'
import type { ServerConnection } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip } from '@/components/ui/tooltip'

type Pending = { kind: 'status' | 'reset'; user: User } | null
export function AdminUsers({ connection }: { connection: ServerConnection }) {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [query, setQuery] = useState('')
  async function load() {
    try {
      setError('')
      setUsers(await api<User[]>(connection, 'GET', '/api/v1/admin/users'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  function create(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void api(connection, 'POST', '/api/v1/admin/users', {
      username: data.get('username'),
      displayName: data.get('displayName'),
      temporaryPassword: data.get('password'),
    })
      .then(async () => {
        setCreateOpen(false)
        form.reset()
        await load()
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : 'Could not create user',
        )
      })
  }
  async function confirm(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) return
    const current = pending
    try {
      if (current.kind === 'status')
        await api(
          connection,
          'PATCH',
          `/api/v1/admin/users/${current.user.id}/status`,
          { status: current.user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' },
        )
      else {
        const data = new FormData(event.currentTarget)
        await api(
          connection,
          'POST',
          `/api/v1/admin/users/${current.user.id}/reset-password`,
          { temporaryPassword: data.get('temporaryPassword') },
        )
      }
      setPending(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }
  const visible = users.filter((user) =>
    `${user.displayName} ${user.username}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <section className="h-full overflow-y-auto bg-slate-50/70 p-5 dark:bg-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
              Administration
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              User management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create organizational accounts and manage access.
            </p>
          </div>
          <Button
            onClick={() => {
              setCreateOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create user
          </Button>
        </header>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                }}
                placeholder="Search users"
                className="h-10 bg-slate-50 pl-9 dark:bg-slate-950"
              />
            </div>
            <span className="ml-4 text-xs text-slate-500">
              {users.length} accounts
            </span>
          </div>
          {error && (
            <p
              role="alert"
              className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="w-16 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr
                    className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    key={user.id}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} />
                        <div>
                          <p className="font-semibold">{user.displayName}</p>
                          {user.mustChangePassword && (
                            <p className="text-[11px] text-amber-600">
                              Password change required
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      @{user.username}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium dark:bg-slate-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="relative px-4 py-3">
                      <Tooltip label="User actions">
                        <button
                          onClick={() => {
                            setMenu(menu === user.id ? null : user.id)
                          }}
                          aria-label={`Actions for ${user.displayName}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <CircleEllipsis className="h-5 w-5" />
                        </button>
                      </Tooltip>
                      {menu === user.id && (
                        <div className="absolute right-10 top-8 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <button
                            onClick={() => {
                              setPending({ kind: 'status', user })
                              setMenu(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {user.status === 'ACTIVE' ? (
                              <UserX size={16} />
                            ) : (
                              <UserCheck size={16} />
                            )}{' '}
                            {user.status === 'ACTIVE'
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                          <button
                            onClick={() => {
                              setPending({ kind: 'reset', user })
                              setMenu(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <KeyRound size={16} />
                            Reset password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(loading || visible.length === 0) && (
            <div className="border-t border-slate-100 px-6 py-14 text-center text-sm text-slate-500 dark:border-slate-800">
              {loading
                ? 'Loading users…'
                : query
                  ? 'No users match your search.'
                  : 'No organizational users yet.'}
            </div>
          )}
        </div>
      </div>
      {createOpen && (
        <Modal
          title="Create user"
          close={() => {
            setCreateOpen(false)
          }}
        >
          <form onSubmit={create} className="space-y-4">
            <Field label="Username">
              <Input
                name="username"
                required
                minLength={3}
                pattern="[A-Za-z0-9._-]+"
                autoFocus
              />
            </Field>
            <Field label="Display name">
              <Input name="displayName" required />
            </Field>
            <Field label="Temporary password">
              <Input
                name="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
              />
            </Field>
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              The user must change this password. Deliver it through an approved
              offline channel.
            </p>
            <Actions
              cancel={() => {
                setCreateOpen(false)
              }}
              submit="Create account"
            />
          </form>
        </Modal>
      )}
      {pending && (
        <Modal
          title={
            pending.kind === 'reset'
              ? 'Reset password'
              : `${pending.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} user`
          }
          close={() => {
            setPending(null)
          }}
        >
          <form
            onSubmit={(event) => {
              void confirm(event)
            }}
            className="space-y-4"
          >
            {pending.kind === 'reset' ? (
              <>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Set a temporary password for{' '}
                  <strong>{pending.user.displayName}</strong>. Existing sessions
                  will be revoked.
                </p>
                <Field label="Temporary password">
                  <Input
                    name="temporaryPassword"
                    type="password"
                    minLength={12}
                    required
                    autoFocus
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {pending.user.status === 'ACTIVE' ? (
                  <>
                    Deactivate <strong>{pending.user.displayName}</strong>? All
                    active sessions will be revoked immediately.
                  </>
                ) : (
                  <>
                    Restore access for{' '}
                    <strong>{pending.user.displayName}</strong>?
                  </>
                )}
              </p>
            )}
            <Actions
              cancel={() => {
                setPending(null)
              }}
              submit={
                pending.kind === 'reset'
                  ? 'Reset password'
                  : pending.user.status === 'ACTIVE'
                    ? 'Deactivate user'
                    : 'Activate user'
              }
              danger={
                pending.kind === 'status' && pending.user.status === 'ACTIVE'
              }
            />
          </form>
        </Modal>
      )}
    </section>
  )
}
function Avatar({ user }: { user: User }) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((value) => value[0])
    .join('')
    .toUpperCase()
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
      {initials || <UserRound size={16} />}
    </span>
  )
}
function StatusBadge({ status }: { status: User['status'] }) {
  return (
    <span
      className={
        status === 'ACTIVE'
          ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }
    >
      <span
        className={
          status === 'ACTIVE'
            ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
            : 'h-1.5 w-1.5 rounded-full bg-slate-400'
        }
      />
      {status}
    </span>
  )
}
function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0"
        aria-label="Close dialog"
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={close}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Label className="block space-y-2">
      <span>{label}</span>
      {children}
    </Label>
  )
}
function Actions({
  cancel,
  submit,
  danger = false,
}: {
  cancel: () => void
  submit: string
  danger?: boolean
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="ghost" onClick={cancel}>
        Cancel
      </Button>
      <Button
        className={
          danger ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-600' : ''
        }
      >
        {submit}
      </Button>
    </div>
  )
}
