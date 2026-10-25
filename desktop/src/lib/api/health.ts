import { invoke } from '@tauri-apps/api/core'
import { baseUrl } from '@/lib/api/auth'
import type { HealthResponse, ServerConnection } from '@/types/connection'

interface ConnectionDiagnostic {
  code: string
  message: string
  reachable: boolean
}
export class ConnectionError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function checkHealth(
  connection: ServerConnection,
): Promise<HealthResponse> {
  const result = await invoke<ConnectionDiagnostic>('connection_diagnostics', {
    baseUrl: baseUrl(connection),
  }).catch((reason: unknown) => {
    const code = typeof reason === 'string' ? reason : 'SERVER_UNAVAILABLE'
    throw new ConnectionError(code, messageFor(code))
  })
  if (!result.reachable) throw new ConnectionError(result.code, result.message)
  return { status: 'UP', service: 'securelan-server' }
}

function messageFor(code: string) {
  switch (code) {
    case 'HTTPS_REQUIRED':
      return 'HTTPS is required for non-loopback servers.'
    case 'EMBEDDED_CREDENTIALS':
      return 'The server address must not contain a username or password.'
    case 'UNSUPPORTED_SCHEME':
      return 'Only HTTP and HTTPS server addresses are supported.'
    case 'TLS_CERTIFICATE_EXPIRED':
      return 'The server certificate has expired. Contact your SecureLAN administrator.'
    case 'TLS_HOSTNAME_MISMATCH':
      return 'The server address does not match its certificate.'
    case 'TLS_CERTIFICATE_UNTRUSTED':
      return 'The server certificate is not trusted on this device.'
    case 'DNS_FAILURE':
      return 'The SecureLAN server name could not be resolved.'
    case 'CONNECTION_REFUSED':
      return 'The server refused the connection. Check that SecureLAN is running.'
    default:
      return 'Unable to reach the SecureLAN server.'
  }
}
