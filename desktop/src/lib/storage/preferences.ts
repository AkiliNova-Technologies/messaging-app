import type { ServerConnection } from '@/types/connection'

const KEY = 'securelan.server-connection.v1'

export function loadServerConnection(): ServerConnection | null {
  try {
    const value = localStorage.getItem(KEY)
    return value ? (JSON.parse(value) as ServerConnection) : null
  } catch {
    return null
  }
}

export function saveServerConnection(connection: ServerConnection) {
  localStorage.setItem(KEY, JSON.stringify(connection))
}
