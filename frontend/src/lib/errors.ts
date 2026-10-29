import axios from 'axios'

interface ApiErrorBody {
  message?: string | string[]
}

/** Extrae un mensaje legible de un error de Axios/JS. */
export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Verifica tu conexión.'
    const message = error.response.data?.message
    if (Array.isArray(message)) return message.join(' · ')
    if (typeof message === 'string' && message) return message
    if (error.response.status === 403) return 'No tienes permisos para realizar esta acción.'
    return fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export const getErrorStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined
