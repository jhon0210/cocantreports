import type { CreateEcaInput, Eca, EcaAdjunto } from '@/types/api'
import { api } from './api'
import { prepararEca } from './archivos.service'

export const ecasService = {
  list: async (): Promise<Eca[]> => (await api.get<Eca[]>('/ecas')).data,
  create: async (input: CreateEcaInput): Promise<Eca> => (await api.post<Eca>('/ecas', await prepararEca(input))).data,
  update: async (id: number, input: CreateEcaInput): Promise<Eca> => (await api.put<Eca>(`/ecas/${id}`, await prepararEca(input))).data,
  download: async (id: number, adjuntoId: number): Promise<Blob> =>
    (await api.get<Blob>(`/ecas/${id}/adjuntos/${adjuntoId}`, { responseType: 'blob' })).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/ecas/${id}`)
  },
}

export async function downloadEcaAdjunto(ecaId: number, adjunto: Pick<EcaAdjunto, 'id' | 'nombre'>): Promise<void> {
  const blob = await ecasService.download(ecaId, adjunto.id)
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = adjunto.nombre
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
