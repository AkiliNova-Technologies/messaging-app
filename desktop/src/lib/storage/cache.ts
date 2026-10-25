import { invoke } from '@tauri-apps/api/core'
import { baseUrl, type User } from '@/lib/api/auth'
import type { ApiConversation, ApiMessage } from '@/lib/api/messaging'
import type { ServerConnection } from '@/types/connection'

export interface OfflineSession {
  user: User
  authorizedUntil: number
}

export const openVerifiedCache = (c: ServerConnection, user: User) =>
  invoke('cache_open_verified', { baseUrl: baseUrl(c), user })
export const restoreOfflineCache = (c: ServerConnection) =>
  invoke<OfflineSession>('cache_restore_offline', { baseUrl: baseUrl(c) })
export const replaceCachedConversations = (
  c: ServerConnection,
  userId: string,
  conversations: ApiConversation[],
) =>
  invoke('cache_replace_conversations', {
    baseUrl: baseUrl(c),
    userId,
    conversations,
  })
export const storeCachedMessages = (
  c: ServerConnection,
  userId: string,
  messages: ApiMessage[],
) => invoke('cache_store_messages', { baseUrl: baseUrl(c), userId, messages })
export const readCachedConversations = (c: ServerConnection, userId: string) =>
  invoke<ApiConversation[]>('cache_read_conversations', {
    baseUrl: baseUrl(c),
    userId,
  })
export const readCachedMessages = (
  c: ServerConnection,
  userId: string,
  conversationId: string,
) =>
  invoke<ApiMessage[]>('cache_read_messages', {
    baseUrl: baseUrl(c),
    userId,
    conversationId,
  })
export const closeCache = () => invoke('cache_close')
