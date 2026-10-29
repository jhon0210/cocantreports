import { create } from 'zustand'
import type { Usuario } from '@/types/api'

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  /** El access token vive solo en memoria: no se escribe en localStorage/sessionStorage. */
  accessToken: string | null
  user: Usuario | null
  setSession: (accessToken: string, user: Usuario) => void
  setAnonymous: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ status: 'authenticated', accessToken, user }),
  setAnonymous: () => set({ status: 'anonymous', accessToken: null, user: null }),
}))
