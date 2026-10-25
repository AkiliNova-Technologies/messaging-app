import { invoke } from '@tauri-apps/api/core'
import { baseUrl } from './auth'
import type { ServerConnection } from '@/types/connection'

export interface BackendStartup {
  mode: 'CLIENT_DESKTOP' | 'SERVER_DESKTOP'
  state: 'READY' | 'STARTED' | 'REMOTE_UNAVAILABLE'
}
export const ensureBackendStarted = (connection: ServerConnection) =>
  invoke<BackendStartup>('ensure_backend_started', {
    baseUrl: baseUrl(connection),
  })
export const deploymentStatus = (connection: ServerConnection) =>
  invoke<BackendStartup>('deployment_status', { baseUrl: baseUrl(connection) })
