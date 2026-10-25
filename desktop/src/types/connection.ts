export type ConnectionStatus =
  'connected' | 'connecting' | 'disconnected' | 'failed'

export interface ServerConnection {
  host: string
  port: number
  transport: 'http' | 'https'
  pinnedIdentity?: string
}

export interface HealthResponse {
  status: 'UP'
  service: 'securelan-server'
}
