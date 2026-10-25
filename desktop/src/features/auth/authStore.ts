import { create } from 'zustand'
import type { User } from '@/lib/api/auth'
export type AuthState =
  | 'INITIALIZING'
  | 'SERVER_STARTING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'OFFLINE_AUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'SERVER_UNAVAILABLE'
interface Store {
  state: AuthState
  user: User | null
  detail: string
  set: (state: AuthState, user?: User | null, detail?: string) => void
}
export const useAuthStore = create<Store>((set) => ({
  state: 'INITIALIZING',
  user: null,
  detail: '',
  set: (state, user = null, detail = '') => {
    set({ state, user, detail })
  },
}))
