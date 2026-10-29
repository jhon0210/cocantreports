import type { CreateEcaInput, UpdateRecuperadorInput } from '@/types/api'
import { api } from './api'

async function usaS3(): Promise<boolean> {
  const { data } = await api.get<{ almacenamiento: 's3' | 'bd' }>('/archivos/config')
  if (data.almacenamiento !== 's3' && data.almacenamiento !== 'bd') throw new Error('Configuracion de archivos no valida')
  return data.almacenamiento === 's3'
}

async function subir(contenido: string, nombre: string, uso: string) {
  const base64 = contenido.startsWith('data:') ? contenido.substring(contenido.indexOf(',') + 1) : contenido
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const mime = bytes[0] === 137 ? 'image/png' : bytes[0] === 255 ? 'image/jpeg' : 'application/pdf'
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = btoa(String.fromCharCode(...digest))
  const { data: carga } = await api.post<{ id: string; url: string; fields: Record<string, string> }>('/archivos/autorizar', {
    uso, nombre, mime, tamano: bytes.length, sha256,
  })
  const form = new FormData()
  for (const [key, value] of Object.entries(carga.fields)) form.append(key, value)
  form.append('file', new Blob([bytes], { type: mime }), nombre)
  const response = await fetch(carga.url, { method: 'POST', body: form, credentials: 'omit', signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`No se pudo cargar el archivo en S3 (${response.status}). Vuelve a intentarlo.`)
  await api.post(`/archivos/${carga.id}/confirmar`)
  return carga.id
}

export async function prepararEca(input: CreateEcaInput) {
  if (!input.adjuntos?.some((doc) => 'contenido' in doc) || !await usaS3()) return input
  const adjuntos = []
  for (const doc of input.adjuntos) {
    adjuntos.push('id' in doc ? doc : { archivo_id: await subir(doc.contenido, doc.nombre, 'eca') })
  }
  return { ...input, adjuntos }
}

export async function prepararRecuperador<T extends UpdateRecuperadorInput>(input: T) {
  if ((!input.foto && !input.documentos?.some((doc) => 'contenido' in doc)) || !await usaS3()) return input
  const { foto, documentos, ...rest } = input
  const refs = []
  for (const doc of documentos ?? []) {
    refs.push('id' in doc ? doc : { tipo: doc.tipo, archivo_id: await subir(doc.contenido, doc.nombre, doc.tipo) })
  }
  const fotoId = foto ? await subir(foto, foto.startsWith('data:image/png;') ? 'foto.png' : 'foto.jpg', 'foto') : undefined
  return {
    ...rest,
    ...(documentos ? { documentos: refs } : {}),
    ...(fotoId ? { foto_archivo_id: fotoId } : {}),
  }
}
