import { useAuthStore } from '@/stores/auth.store'
import type { AuthResponse } from '@/types/api'
import { api, refreshSession } from './api'

export async function login(usuario: string, clave: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { usuario, clave })
  useAuthStore.getState().setSession(data.access_token, data.user)
  return data
}

/** Revoca el refresh token en el backend y limpia la sesión local, aunque la red falle. */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    useAuthStore.getState().setAnonymous()
  }
}

let bootstrapPromise: Promise<void> | null = null

/** Restaura la sesión al cargar la app usando la cookie de refresh (el access token no se persiste). */
export function bootstrapSession(): Promise<void> {
  bootstrapPromise ??= refreshSession().then(
    () => undefined,
    () => undefined,
  )
  return bootstrapPromise
}
