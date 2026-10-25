export type Presence = 'online' | 'away' | 'offline'

export interface Employee {
  id: string
  name: string
  initials: string
  role: string
  department: string
  presence: Presence
  avatarClass: string
}

export interface Conversation {
  id: string
  employee: Employee
  preview: string
  timestamp: string
  unread: number
  pinned?: boolean
}

export interface Message {
  id: string
  conversationId: string
  direction: 'incoming' | 'outgoing'
  body: string
  timestamp: string
  delivery?: 'sending' | 'sent' | 'failed'
  clientRequestId?: string
  serverSequence: number
}

export interface SharedFile {
  id: string
  name: string
  meta: string
  kind: 'document' | 'image'
}
