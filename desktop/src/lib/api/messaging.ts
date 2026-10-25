import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { api, baseUrl } from '@/lib/api/auth'
import type { ServerConnection } from '@/types/connection'
export interface PublicUser {
  id: string
  displayName: string
  username: string
  avatarInitials: string
}
export interface ApiMessage {
  id: string
  conversationId: string
  senderId: string
  clientRequestId: string
  serverSequence: number
  payloadType: 'TEXT'
  text: string
  createdAt: string
}
export interface ApiConversation {
  id: string
  participant: PublicUser
  createdAt: string
  updatedAt: string
  lastMessage: ApiMessage | null
}
export interface MessagePage {
  items: ApiMessage[]
  nextBefore: number | null
}
export interface RealtimeEnvelope {
  eventId: string
  type: 'connection.ready' | 'message.created' | 'session.revoked'
  conversationId?: string
  serverSequence?: number
  payload: unknown
}
export type RealtimeState =
  'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'
export const listConversations = (c: ServerConnection) =>
  api<ApiConversation[]>(c, 'GET', '/api/v1/conversations?size=100')
export const createConversation = (
  c: ServerConnection,
  participantId: string,
) => api<ApiConversation>(c, 'POST', '/api/v1/conversations', { participantId })
export const listMessages = (
  c: ServerConnection,
  id: string,
  before?: number,
) =>
  api<MessagePage>(
    c,
    'GET',
    `/api/v1/conversations/${id}/messages?size=50${before ? `&before=${String(before)}` : ''}`,
  )
export const sendMessage = (
  c: ServerConnection,
  id: string,
  clientRequestId: string,
  text: string,
) =>
  api<ApiMessage>(c, 'POST', `/api/v1/conversations/${id}/messages`, {
    clientRequestId,
    payloadType: 'TEXT',
    text,
  })
export const directory = (c: ServerConnection, search: string) =>
  api<{ items: PublicUser[] }>(
    c,
    'GET',
    `/api/v1/users/directory?size=50&search=${encodeURIComponent(search)}`,
  )
export const startRealtime = (c: ServerConnection) =>
  invoke('realtime_start', { baseUrl: baseUrl(c) })
export const stopRealtime = () => invoke('realtime_stop')
export async function onRealtime(
  event: (value: RealtimeEnvelope) => void,
  state: (value: RealtimeState) => void,
): Promise<UnlistenFn> {
  const a = await listen<RealtimeEnvelope>(
    'securelan://realtime-event',
    (e) => {
      event(e.payload)
    },
  )
  const b = await listen<{ state: RealtimeState }>(
    'securelan://realtime-state',
    (e) => {
      state(e.payload.state)
    },
  )
  return () => {
    a()
    b()
  }
}
