import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '@/lib/env'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthResponse } from '@/types/api'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // necesario para enviar la cookie HttpOnly del refresh token a /auth/*
  timeout: 15_000,
})

let refreshPromise: Promise<AuthResponse> | null = null

/**
 * Renueva la sesión con la cookie HttpOnly. Las llamadas simultáneas comparten una sola petición,
 * así no se consumen (y rotan) varios refresh tokens a la vez.
 */
export function refreshSession(): Promise<AuthResponse> {
  refreshPromise ??= api
    .post<AuthResponse>('/auth/refresh')
    .then((res) => {
      useAuthStore.getState().setSession(res.data.access_token, res.data.user)
      return res.data
    })
    .catch((error) => {
      useAuthStore.getState().setAnonymous()
      throw error
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

const AUTH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout']

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const isAuthCall = AUTH_URLS.some((url) => original?.url?.startsWith(url))

    if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error)
    }

    original._retried = true // un solo reintento por petición
    try {
      const session = await refreshSession()
      original.headers.set('Authorization', `Bearer ${session.access_token}`)
      return api(original)
    } catch {
      // refreshSession ya dejó el estado en "anonymous": ProtectedRoute redirige a /login
      return Promise.reject(error)
    }
  },
)
