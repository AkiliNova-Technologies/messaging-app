import { MessageSquarePlus, Pin, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar } from '@/features/messaging/components/Avatar'
import type { Conversation } from '@/features/messaging/types/messaging'
import { cn } from '@/lib/utils'

interface Props {
  conversations: Conversation[]
  selectedId: string
  onSelect: (id: string) => void
  mobileHidden: boolean
  onNew: () => void
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  mobileHidden,
  onNew,
}: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const visible = useMemo(
    () =>
      conversations.filter(
        (item) =>
          (filter === 'all' || item.unread > 0) &&
          `${item.employee.name} ${item.preview}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [conversations, filter, query],
  )
  return (
    <section
      className={cn(
        'w-full shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex md:w-[310px] xl:w-[330px]',
        mobileHidden ? 'hidden' : 'flex',
      )}
      aria-label="Conversations"
    >
      <header className="border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-800">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
              SecureLAN
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Messages</h1>
          </div>
          <button
            onClick={onNew}
            aria-label="New conversation"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700"
          >
            <MessageSquarePlus className="h-[17px] w-[17px]" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder="Search conversations"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <div className="mt-4 flex gap-5 text-sm">
          <button
            onClick={() => {
              setFilter('all')
            }}
            className={cn(
              'border-b-2 pb-2 font-medium transition',
              filter === 'all'
                ? 'border-violet-500 text-slate-950 dark:text-white'
                : 'border-transparent text-slate-400',
            )}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilter('unread')
            }}
            className={cn(
              'border-b-2 pb-2 font-medium transition',
              filter === 'unread'
                ? 'border-violet-500 text-slate-950 dark:text-white'
                : 'border-transparent text-slate-400',
            )}
          >
            Unread
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <div className="px-4 py-14 text-center text-sm text-slate-500">
            No conversations match your search.
          </div>
        )}
        {visible.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => {
              onSelect(conversation.id)
            }}
            className={cn(
              'relative flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-slate-900',
              selectedId === conversation.id &&
                'bg-violet-50 dark:bg-violet-950/35',
            )}
          >
            {selectedId === conversation.id && (
              <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-violet-500" />
            )}
            <Avatar employee={conversation.employee} showPresence />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {conversation.employee.name}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {conversation.timestamp}
                </span>
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {conversation.preview}
                </span>
                {conversation.unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                    {conversation.unread}
                  </span>
                )}
              </span>
            </span>
            {conversation.pinned && (
              <Pin className="absolute bottom-2.5 right-3 h-3 w-3 text-slate-300" />
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
