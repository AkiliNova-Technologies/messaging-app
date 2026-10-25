import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, CircleAlert, LoaderCircle, PlugZap } from 'lucide-react'
import { useCallback, useEffect, useState, type SyntheticEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkHealth } from '@/lib/api/health'
import {
  loadServerConnection,
  saveServerConnection,
} from '@/lib/storage/preferences'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionStatus, ServerConnection } from '@/types/connection'
import { useAuthStore } from '@/features/auth/authStore'
import { closeCache } from '@/lib/storage/cache'
import { deploymentStatus } from '@/lib/api/deployment'

const schema = z.object({
  transport: z.enum(['http', 'https']),
  host: z
    .string()
    .trim()
    .min(1, 'Enter a hostname or IP address')
    .regex(/^[a-zA-Z0-9.:[\]-]+$/, 'Enter a valid hostname or IP address'),
  port: z.coerce.number().int().min(1).max(65535),
})
type FormValues = z.infer<typeof schema>
type FormInput = z.input<typeof schema>
const labels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  failed: 'Connection Failed',
}

export function ConnectionCard() {
  const { status, detail, setState } = useConnectionStore()
  const [saved] = useState(loadServerConnection)
  const [deploymentMode, setDeploymentMode] = useState('CLIENT_DESKTOP')
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      host: saved?.host ?? '127.0.0.1',
      port: saved?.port ?? 8080,
      transport: saved?.transport ?? 'http',
    },
  })

  const test = useCallback(
    async (values: FormValues, quiet = false) => {
      const connection: ServerConnection = {
        host: values.host,
        port: values.port,
        transport: values.transport,
      }
      if (!quiet) setState('connecting', 'Checking server reachability…')
      try {
        await checkHealth(connection)
        const originChanged =
          saved !== null &&
          (saved.host !== connection.host ||
            saved.port !== connection.port ||
            saved.transport !== connection.transport)
        if (originChanged) {
          await invoke('realtime_stop')
          await closeCache()
        }
        saveServerConnection(connection)
        const auth = useAuthStore.getState()
        if (
          originChanged &&
          (auth.state === 'AUTHENTICATED' ||
            auth.state === 'OFFLINE_AUTHENTICATED')
        ) {
          auth.set(
            'UNAUTHENTICATED',
            null,
            'Server changed. Sign in to the selected server.',
          )
        }
        setState(
          'connected',
          connection.transport === 'https'
            ? 'Secure connection established. The certificate chain and server identity were verified.'
            : 'Loopback development server reached over local HTTP.',
        )
      } catch (error) {
        setState(
          'failed',
          error instanceof Error && error.name === 'AbortError'
            ? 'Connection timed out after 5 seconds.'
            : error instanceof Error
              ? error.message
              : 'Unable to reach server.',
        )
      }
    },
    [saved, setState],
  )

  useEffect(() => {
    if (!saved) return
    void deploymentStatus(saved)
      .then((value) => {
        setDeploymentMode(value.mode)
      })
      .catch(() => {})
    void test({
      host: saved.host,
      port: saved.port,
      transport: saved.transport,
    })
    const timer = window.setInterval(() => {
      void test(
        { host: saved.host, port: saved.port, transport: saved.transport },
        true,
      )
    }, 15_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [saved, test])

  const onSubmit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    void form.handleSubmit(async (values) => {
      await test(values)
    })(event)
  }

  const Icon =
    status === 'connected'
      ? CheckCircle2
      : status === 'connecting'
        ? LoaderCircle
        : status === 'failed'
          ? CircleAlert
          : PlugZap
  return (
    <Card className="w-full max-w-xl p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Server connection
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Connect to your LAN host
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:bg-slate-800">
          <Icon
            className={`h-4 w-4 ${status === 'connecting' ? 'animate-spin' : ''}`}
          />
          {labels[status]}
        </div>
      </div>
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-[110px_1fr_120px]">
          <div className="space-y-2">
            <Label htmlFor="transport">Transport</Label>
            <select
              id="transport"
              className="h-10 w-full rounded-lg border border-slate-300 bg-transparent px-3"
              {...form.register('transport')}
            >
              <option value="https">HTTPS</option>
              <option value="http">HTTP (loopback only)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="host">Server hostname or IP</Label>
            <Input
              id="host"
              placeholder="192.168.1.10"
              autoComplete="off"
              {...form.register('host')}
            />
            <p className="text-xs text-rose-600">
              {form.formState.errors.host?.message}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              inputMode="numeric"
              {...form.register('port')}
            />
            <p className="text-xs text-rose-600">
              {form.formState.errors.port?.message}
            </p>
          </div>
        </div>
        <Button
          className="w-full"
          type="submit"
          disabled={status === 'connecting'}
        >
          Test and save connection
        </Button>
      </form>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <p>{detail}</p>
        <p className="mt-2 text-xs">
          Operator deployment mode: {deploymentMode}
        </p>
        <p className="mt-2 text-xs">
          HTTPS checks use the operating system trust store and require a
          certificate matching this exact hostname or IP address.
        </p>
      </div>
    </Card>
  )
}
