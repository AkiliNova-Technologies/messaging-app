import type {
  Conversation,
  Message,
  SharedFile,
} from '@/features/messaging/types/messaging'

// Development-only presentation data. Replace this module with API adapters once
// messaging contracts exist; production services must never import these fixtures.
export const developmentConversations: Conversation[] = [
  {
    id: 'c-1',
    employee: {
      id: 'e-1',
      name: 'Amina Nsubuga',
      initials: 'AN',
      role: 'Product Designer',
      department: 'Product & Design',
      presence: 'online',
      avatarClass:
        'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
    },
    preview: 'The updated flow is ready for review.',
    timestamp: '10:42',
    unread: 2,
    pinned: true,
  },
  {
    id: 'c-2',
    employee: {
      id: 'e-2',
      name: 'Daniel Okello',
      initials: 'DO',
      role: 'Backend Engineer',
      department: 'Engineering',
      presence: 'away',
      avatarClass:
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
    },
    preview: 'I will check the sync logs shortly.',
    timestamp: '09:18',
    unread: 0,
  },
  {
    id: 'c-3',
    employee: {
      id: 'e-3',
      name: 'Grace Atim',
      initials: 'GA',
      role: 'Operations Lead',
      department: 'Operations',
      presence: 'online',
      avatarClass:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    },
    preview: 'Can we meet after the daily briefing?',
    timestamp: 'Yesterday',
    unread: 1,
  },
  {
    id: 'c-4',
    employee: {
      id: 'e-4',
      name: 'Isaac Mugisha',
      initials: 'IM',
      role: 'Systems Administrator',
      department: 'IT Services',
      presence: 'offline',
      avatarClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
    },
    preview: 'Server maintenance is complete.',
    timestamp: 'Mon',
    unread: 0,
  },
  {
    id: 'c-5',
    employee: {
      id: 'e-5',
      name: 'Lydia Namukasa',
      initials: 'LN',
      role: 'Finance Officer',
      department: 'Finance',
      presence: 'offline',
      avatarClass:
        'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    },
    preview: 'Thanks, I received the document.',
    timestamp: 'Fri',
    unread: 0,
  },
]

export const developmentMessages: Message[] = [
  {
    id: 'm-1',
    conversationId: 'c-1',
    direction: 'incoming',
    body: 'Good morning! I finished the desktop conversation flow.',
    timestamp: '10:21',
    serverSequence: 1,
  },
  {
    id: 'm-2',
    conversationId: 'c-1',
    direction: 'incoming',
    body: 'The updated flow is ready for review. I kept the states simple so they can map cleanly to synchronization later.',
    timestamp: '10:23',
    serverSequence: 2,
  },
  {
    id: 'm-3',
    conversationId: 'c-1',
    direction: 'outgoing',
    body: 'Great. Please share the notes here and I’ll review them before the afternoon stand-up.',
    timestamp: '10:31',
    delivery: 'sent',
    serverSequence: 3,
  },
  {
    id: 'm-4',
    conversationId: 'c-1',
    direction: 'incoming',
    body: 'Sent. I also added a short list of offline edge cases we should discuss.',
    timestamp: '10:42',
    serverSequence: 4,
  },
  {
    id: 'm-5',
    conversationId: 'c-2',
    direction: 'incoming',
    body: 'I will check the sync logs shortly and send a summary.',
    timestamp: '09:18',
    serverSequence: 1,
  },
]

export const developmentSharedFiles: SharedFile[] = [
  {
    id: 'f-1',
    name: 'desktop-flow.pdf',
    meta: '1.8 MB · Today',
    kind: 'document',
  },
  { id: 'f-2', name: 'sync-notes.md', meta: '12 KB · Today', kind: 'document' },
  {
    id: 'f-3',
    name: 'layout-review.png',
    meta: '840 KB · Yesterday',
    kind: 'image',
  },
]
