import { ArrowLeft, Check, Info, Send } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Avatar } from '@/features/messaging/components/Avatar'
import type {
  Conversation,
  Message,
} from '@/features/messaging/types/messaging'
import { cn } from '@/lib/utils'
interface Props {
  conversation: Conversation
  messages: Message[]
  onBack: () => void
  onToggleInfo: () => void
  mobileVisible: boolean
  onSend: (text: string) => Promise<void>
  onLoadOlder: () => void
  hasOlder: boolean
  sending: boolean
  error: string
}
export function ChatWorkspace({
  conversation,
  messages,
  onBack,
  onToggleInfo,
  mobileVisible,
  onSend,
  onLoadOlder,
  hasOlder,
  sending,
  error,
}: Props) {
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const displayed = messages.filter((m) => m.conversationId === conversation.id)
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayed.length, conversation.id])
  async function submit() {
    const body = draft.trim()
    if (!body || sending) return
    setDraft('')
    try {
      await onSend(body)
    } catch {
      setDraft(body)
    }
  }
  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }
  return (
    <section
      className={cn(
        'min-w-0 flex-1 flex-col bg-white dark:bg-slate-950 md:flex',
        mobileVisible ? 'flex' : 'hidden',
      )}
      aria-label={`Conversation with ${conversation.employee.name}`}
    >
      <header className="flex h-[76px] shrink-0 items-center gap-3 border-b border-slate-200 px-4 md:px-6 dark:border-slate-800">
        <button onClick={onBack} aria-label="Back" className="md:hidden">
          <ArrowLeft />
        </button>
        <Avatar employee={conversation.employee} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {conversation.employee.name}
          </h2>
          <p className="text-xs text-slate-500">
            @{conversation.employee.role}
          </p>
        </div>
        <button
          onClick={onToggleInfo}
          aria-label="Conversation information"
          className="grid h-9 w-9 place-items-center rounded-lg border dark:border-slate-800"
        >
          <Info className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfcfd] px-4 py-6 dark:bg-slate-950 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {hasOlder && (
            <button
              onClick={onLoadOlder}
              className="mx-auto text-xs font-medium text-violet-600"
            >
              Load older messages
            </button>
          )}
          {displayed.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">
              Send the first message to {conversation.employee.name}.
            </div>
          ) : (
            displayed.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex max-w-[78%] flex-col',
                  m.direction === 'outgoing'
                    ? 'ml-auto items-end'
                    : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[13px]',
                    m.direction === 'outgoing'
                      ? 'rounded-br-md bg-violet-600 text-white'
                      : 'rounded-bl-md border bg-white dark:border-slate-800 dark:bg-slate-900',
                  )}
                >
                  {m.body}
                </div>
                <span
                  className={cn(
                    'mt-1 flex items-center gap-1 text-[10px] text-slate-400',
                    m.delivery === 'failed' && 'text-red-500',
                  )}
                >
                  {m.timestamp}
                  {m.direction === 'outgoing' && <Check className="h-3 w-3" />}
                  {m.delivery === 'sending'
                    ? ' Sending'
                    : m.delivery === 'failed'
                      ? ' Failed'
                      : ''}
                </span>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="shrink-0 border-t p-3 dark:border-slate-800">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
          <textarea
            value={draft}
            maxLength={4000}
            onChange={(e) => {
              setDraft(e.target.value)
            }}
            onKeyDown={keyDown}
            rows={1}
            placeholder="Write a message…"
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            onClick={() => void submit()}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[10px] text-slate-400">
          Enter to send · Shift + Enter for a new line · {draft.length}/4000
        </p>
        {error && (
          <p
            role="alert"
            className="mx-auto mt-1 max-w-3xl text-xs text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
