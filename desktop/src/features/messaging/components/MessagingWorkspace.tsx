import { MessageCircle, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationList } from './ConversationList'
import { ChatWorkspace } from './ChatWorkspace'
import { ConversationInfo } from './ConversationInfo'
import { useAuthStore } from '@/features/auth/authStore'
import { loadServerConnection } from '@/lib/storage/preferences'
import {
  createConversation,
  directory,
  listConversations,
  listMessages,
  onRealtime,
  sendMessage,
  startRealtime,
  stopRealtime,
  type ApiConversation,
  type ApiMessage,
  type PublicUser,
  type RealtimeState,
} from '@/lib/api/messaging'
import type {
  Conversation,
  Employee,
  Message,
} from '@/features/messaging/types/messaging'
import { ApiError, restore, type User } from '@/lib/api/auth'
import {
  closeCache,
  openVerifiedCache,
  readCachedConversations,
  readCachedMessages,
  replaceCachedConversations,
  storeCachedMessages,
} from '@/lib/storage/cache'

const palette =
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
function employee(u: PublicUser): Employee {
  return {
    id: u.id,
    name: u.displayName,
    initials: u.avatarInitials,
    role: u.username,
    department: '',
    presence: 'offline',
    avatarClass: palette,
  }
}
function conversation(c: ApiConversation): Conversation {
  return {
    id: c.id,
    employee: employee(c.participant),
    preview: c.lastMessage?.text ?? 'No messages yet',
    timestamp: c.lastMessage
      ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    unread: 0,
  }
}
function message(m: ApiMessage, current: string): Message {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.senderId === current ? 'outgoing' : 'incoming',
    body: m.text,
    timestamp: new Date(m.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    delivery: 'sent',
    clientRequestId: m.clientRequestId,
    serverSequence: m.serverSequence,
  }
}
function merge(existing: Message[], incoming: Message[]) {
  const map = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) {
    for (const [id, value] of map)
      if (value.clientRequestId && value.clientRequestId === m.clientRequestId)
        map.delete(id)
    map.set(m.id, m)
  }
  return [...map.values()].sort((a, b) => a.serverSequence - b.serverSequence)
}

export function MessagingWorkspace({ current }: { current: User }) {
  const authSet = useAuthStore((s) => s.set)
  const offline = useAuthStore((s) => s.state === 'OFFLINE_AUTHENTICATED')
  const [connection] = useState(() => loadServerConnection())
  const [selected, setSelected] = useState('')
  const selectedRef = useRef('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Partial<Record<string, Message[]>>>(
    {},
  )
  const [cursors, setCursors] = useState<Record<string, number | null>>({})
  const [info, setInfo] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(() =>
    connection ? '' : 'Configure a server connection.',
  )
  const [sending, setSending] = useState(false)
  const [realtime, setRealtime] = useState<RealtimeState>('DISCONNECTED')
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  useEffect(() => {
    if (!offline || !connection) return
    const timer = window.setInterval(() => {
      void restore(connection)
        .then(async (user) => {
          await openVerifiedCache(connection, user)
          authSet('AUTHENTICATED', user)
        })
        .catch((reason: unknown) => {
          if (
            reason instanceof ApiError &&
            [401, 403].includes(reason.status)
          ) {
            setConversations([])
            setMessages({})
            void closeCache()
            authSet('SESSION_EXPIRED', null, 'Server authorization was denied.')
          }
        })
    }, 5000)
    return () => {
      window.clearInterval(timer)
    }
  }, [authSet, connection, offline])
  const refresh = useCallback(async () => {
    if (!connection) return
    const values = await listConversations(connection)
    setConversations(values.map(conversation))
    await replaceCachedConversations(connection, current.id, values)
  }, [connection, current.id])
  const recover = useCallback(
    async (id: string) => {
      if (!connection || !id) return
      const page = await listMessages(connection, id)
      await storeCachedMessages(connection, current.id, page.items)
      setMessages((v) => ({
        ...v,
        [id]: merge(
          v[id] ?? [],
          page.items.map((m) => message(m, current.id)),
        ),
      }))
      setCursors((v) => ({ ...v, [id]: page.nextBefore }))
    },
    [connection, current.id],
  )
  useEffect(() => {
    if (!connection) return
    let cleanup = () => {}
    const active = { current: true }
    void (async () => {
      try {
        const cachedConversations = await readCachedConversations(
          connection,
          current.id,
        )
        if (active.current)
          setConversations(cachedConversations.map(conversation))
        if (offline) return
        cleanup = await onRealtime((event) => {
          if (event.type === 'message.created') {
            const value = event.payload as ApiMessage
            setMessages((v) => ({
              ...v,
              [value.conversationId]: merge(v[value.conversationId] ?? [], [
                message(value, current.id),
              ]),
            }))
            void storeCachedMessages(connection, current.id, [value])
            void refresh()
          } else if (event.type === 'connection.ready') {
            void refresh()
            if (selectedRef.current) void recover(selectedRef.current)
          } else {
            void stopRealtime()
            void closeCache()
            authSet(
              'SESSION_EXPIRED',
              null,
              'Your session is no longer active.',
            )
          }
        }, setRealtime)
        await refresh()
        await startRealtime(connection)
      } catch (e) {
        if (
          active.current &&
          e instanceof ApiError &&
          [401, 403].includes(e.status)
        ) {
          setConversations([])
          setMessages({})
          void closeCache()
          authSet('SESSION_EXPIRED', null, 'Server authorization was denied.')
        } else if (active.current)
          setError(e instanceof Error ? e.message : 'Unable to load messaging')
      } finally {
        if (active.current) setLoading(false)
      }
    })()
    return () => {
      active.current = false
      cleanup()
      void stopRealtime()
    }
  }, [authSet, connection, current.id, offline, recover, refresh])
  async function select(id: string) {
    if (!connection) return
    setSelected(id)
    setError('')
    if (!messages[id])
      try {
        const cached = await readCachedMessages(connection, current.id, id)
        setMessages((value) => ({
          ...value,
          [id]: cached.map((item) => message(item, current.id)),
        }))
        if (!offline) await recover(id)
      } catch (e) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setConversations([])
          setMessages({})
          await closeCache()
          authSet('SESSION_EXPIRED', null, 'Server authorization was denied.')
          return
        }
        setError(e instanceof Error ? e.message : 'Unable to load messages')
      }
  }
  async function loadOlder() {
    if (offline || !connection || !selected || !cursors[selected]) return
    const page = await listMessages(connection, selected, cursors[selected])
    await storeCachedMessages(connection, current.id, page.items)
    setMessages((v) => ({
      ...v,
      [selected]: merge(
        page.items.map((m) => message(m, current.id)),
        v[selected] ?? [],
      ),
    }))
    setCursors((v) => ({ ...v, [selected]: page.nextBefore }))
  }
  async function send(text: string) {
    if (offline) throw new Error('Sending is unavailable while offline.')
    if (!connection || !selected) return
    const requestId = crypto.randomUUID()
    const local: Message = {
      id: `pending-${requestId}`,
      conversationId: selected,
      direction: 'outgoing',
      body: text,
      timestamp: 'Now',
      delivery: 'sending',
      clientRequestId: requestId,
      serverSequence: Number.MAX_SAFE_INTEGER,
    }
    setMessages((v) => ({
      ...v,
      [selected]: merge(v[selected] ?? [], [local]),
    }))
    setSending(true)
    setError('')
    try {
      const saved = await sendMessage(connection, selected, requestId, text)
      await storeCachedMessages(connection, current.id, [saved])
      setMessages((v) => ({
        ...v,
        [selected]: merge(v[selected] ?? [], [message(saved, current.id)]),
      }))
      await refresh()
    } catch (e) {
      setMessages((v) => ({
        ...v,
        [selected]: (v[selected] ?? []).map((m) =>
          m.clientRequestId === requestId ? { ...m, delivery: 'failed' } : m,
        ),
      }))
      setError(e instanceof Error ? e.message : 'Message could not be sent')
      throw e
    } finally {
      setSending(false)
    }
  }
  const active = conversations.find((c) => c.id === selected)
  return (
    <div className="relative flex h-full min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-950">
      <ConversationList
        conversations={conversations}
        selectedId={selected}
        onSelect={(id) => void select(id)}
        mobileHidden={Boolean(active)}
        onNew={() => {
          setNewOpen(true)
        }}
      />
      {active ? (
        <>
          <ChatWorkspace
            conversation={active}
            messages={messages[selected] ?? []}
            onBack={() => {
              setSelected('')
            }}
            onToggleInfo={() => {
              setInfo((v) => !v)
            }}
            mobileVisible
            onSend={send}
            onLoadOlder={() => void loadOlder()}
            hasOlder={Boolean(cursors[selected])}
            sending={sending}
            error={error}
          />
          <ConversationInfo
            conversation={active}
            files={[]}
            open={info}
            onClose={() => {
              setInfo(false)
            }}
          />
        </>
      ) : (
        <section className="hidden min-w-0 flex-1 place-items-center bg-[#fcfcfd] text-center dark:bg-slate-950 md:grid">
          <div>
            <MessageCircle className="mx-auto h-12 w-12 text-violet-500" />
            <h2 className="mt-4 font-semibold">
              {loading ? 'Loading conversations…' : 'Select a conversation'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {offline
                ? 'Offline — showing securely cached messages'
                : realtime === 'CONNECTED'
                  ? 'Connected for real-time messages'
                  : realtime === 'RECONNECTING'
                    ? 'Reconnecting to the LAN server…'
                    : 'Messages remain available from the server'}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        </section>
      )}
      {newOpen && connection && !offline && (
        <DirectoryDialog
          connection={connection}
          close={() => {
            setNewOpen(false)
          }}
          choose={async (user) => {
            const made = await createConversation(connection, user.id)
            await refresh()
            setNewOpen(false)
            await select(made.id)
          }}
        />
      )}
    </div>
  )
}

function DirectoryDialog({
  connection,
  close,
  choose,
}: {
  connection: NonNullable<ReturnType<typeof loadServerConnection>>
  close: () => void
  choose: (u: PublicUser) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<PublicUser[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      void directory(connection, query)
        .then((r) => {
          setUsers(r.items)
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : 'Search failed')
        })
    }, 200)
    return () => {
      clearTimeout(timer)
    }
  }, [connection, query])
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Start a conversation</h2>
          <button onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            placeholder="Search employees"
            className="h-10 w-full rounded-lg border bg-transparent pl-9 pr-3 text-sm dark:border-slate-700"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-3 max-h-80 overflow-y-auto">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => void choose(u)}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${palette}`}
              >
                {u.avatarInitials}
              </span>
              <span>
                <span className="block text-sm font-medium">
                  {u.displayName}
                </span>
                <span className="block text-xs text-slate-500">
                  @{u.username}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
