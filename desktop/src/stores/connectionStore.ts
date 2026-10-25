import { create } from 'zustand'
import type { ConnectionStatus } from '@/types/connection'

interface State {
  status: ConnectionStatus
  detail: string
  setState: (status: ConnectionStatus, detail: string) => void
}
export const useConnectionStore = create<State>((set) => ({
  status: 'disconnected',
  detail: 'Configure a server to begin.',
  setState: (status, detail) => {
    set({ status, detail })
  },
}))
