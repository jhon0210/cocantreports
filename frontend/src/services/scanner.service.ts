const SCANNER_URL = 'http://localhost:17843'

function esResultado(value: unknown): value is { contenido: string } {
  return typeof value === 'object' && value !== null && 'contenido' in value
    && typeof value.contenido === 'string'
    && value.contenido.length > 0 && value.contenido.length <= 1_398_104
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value.contenido)
}

export async function escanearDocumento(clave: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(clave)) throw new Error('Pega la clave de 64 caracteres que muestra el conector local.')
  let response: Response
  try {
    response = await fetch(`${SCANNER_URL}/scan`, {
      method: 'POST',
      headers: { 'X-Cocjant-Scanner-Key': clave },
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(300_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('El escáner no respondió en 5 minutos. Cierra el diálogo de Windows antes de reintentar.')
    }
    throw new Error('No se pudo contactar al conector local. Comprueba que esté ejecutándose, el origen permitido y el permiso de acceso a la red local del navegador.')
  }
  const data: unknown = await response.json()
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error : 'El conector no pudo escanear el documento.'
    throw new Error(message)
  }
  if (!esResultado(data)) throw new Error('El conector devolvió un documento no válido o demasiado grande.')
  return data.contenido
}
