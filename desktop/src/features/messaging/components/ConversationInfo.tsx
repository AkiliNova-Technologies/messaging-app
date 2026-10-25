import {
  ChevronRight,
  FileImage,
  FileText,
  LockKeyhole,
  ShieldAlert,
  X,
} from 'lucide-react'
import { Avatar } from '@/features/messaging/components/Avatar'
import type {
  Conversation,
  SharedFile,
} from '@/features/messaging/types/messaging'
import { cn } from '@/lib/utils'

export function ConversationInfo({
  conversation,
  files,
  open,
  onClose,
}: {
  conversation: Conversation
  files: SharedFile[]
  open: boolean
  onClose: () => void
}) {
  return (
    <aside
      className={cn(
        'w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
        open
          ? 'absolute inset-y-0 right-0 z-40 flex shadow-2xl xl:static xl:shadow-none'
          : 'hidden',
      )}
      aria-label="Conversation information"
    >
      <header className="flex h-[76px] items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Conversation info</h2>
        <button
          onClick={onClose}
          aria-label="Close conversation information"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 xl:hidden dark:hover:bg-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <Avatar employee={conversation.employee} size="lg" showPresence />
          <h3 className="mt-3 font-semibold">{conversation.employee.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {conversation.employee.role}
          </p>
          <span className="mt-3 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {conversation.employee.presence}
          </span>
        </div>
        <div className="my-6 h-px bg-slate-200 dark:bg-slate-800" />
        <section>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-violet-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conversation security
            </h3>
          </div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/35">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Identity not verified
                </p>
                <p className="mt-1 text-[11px] leading-4 text-amber-800/75 dark:text-amber-300/75">
                  End-to-end encryption and device verification are not
                  implemented.
                </p>
              </div>
            </div>
            <button
              disabled
              className="mt-3 w-full rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 opacity-60 dark:border-amber-800 dark:text-amber-300"
            >
              Verification unavailable
            </button>
          </div>
        </section>
        <div className="my-6 h-px bg-slate-200 dark:bg-slate-800" />
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Shared files
            </h3>
            <button className="flex items-center text-[11px] font-medium text-violet-600">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-900">
                  {file.kind === 'image' ? (
                    <FileImage className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{file.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {file.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
