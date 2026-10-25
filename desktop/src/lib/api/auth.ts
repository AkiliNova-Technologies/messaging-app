import { invoke } from '@tauri-apps/api/core'
import type { ServerConnection } from '@/types/connection'

export interface User {
  id: string
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'DISABLED'
  mustChangePassword: boolean
  createdAt: string
  lastLoginAt: string | null
}
interface ApiResult<T> {
  status: number
  body: T & { code?: string; message?: string }
}
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}
export function baseUrl(connection: ServerConnection) {
  const host =
    connection.host.includes(':') && !connection.host.startsWith('[')
      ? `[${connection.host}]`
      : connection.host
  return `${connection.transport}://${host}:${String(connection.port)}`
}
function unwrap<T>(result: ApiResult<T>): T {
  if (result.status < 200 || result.status >= 300)
    throw new ApiError(
      result.body.code ?? 'REQUEST_FAILED',
      result.body.message ?? 'Request failed',
      result.status,
    )
  return result.body
}
export async function login(
  connection: ServerConnection,
  username: string,
  password: string,
) {
  return unwrap(
    await invoke<ApiResult<{ user: User; session: { expiresAt: string } }>>(
      'auth_login',
      { input: { baseUrl: baseUrl(connection), username, password } },
    ),
  )
}
export async function restore(connection: ServerConnection) {
  return unwrap(
    await invoke<ApiResult<User>>('auth_restore', {
      baseUrl: baseUrl(connection),
    }),
  )
}
export async function logout(connection: ServerConnection) {
  await invoke('auth_logout', { baseUrl: baseUrl(connection) })
}
export async function retryRevocation(connection: ServerConnection) {
  await invoke('retry_pending_revocation', { baseUrl: baseUrl(connection) })
}
export async function api<T>(
  connection: ServerConnection,
  method: string,
  path: string,
  body?: unknown,
) {
  return unwrap(
    await invoke<ApiResult<T>>('auth_request', {
      baseUrl: baseUrl(connection),
      method,
      path,
      body: body ?? null,
    }),
  )
}
