import type { CreateRecuperadorInput, EstadoRecuperador, Recuperador, UpdateRecuperadorInput } from '@/types/api'
import { api } from './api'
import { prepararRecuperador } from './archivos.service'

export const recuperadoresService = {
  documento: async (id: number, documentoId: number): Promise<Blob> =>
    (await api.get<Blob>(`/recuperadores/${id}/documentos/${documentoId}`, { responseType: 'blob' })).data,
  list: async (): Promise<Recuperador[]> => (await api.get<Recuperador[]>('/recuperadores')).data,
  estados: async (): Promise<EstadoRecuperador[]> => (await api.get<EstadoRecuperador[]>('/recuperadores/estados')).data,
  /** Detalle completo, incluida la foto (el listado no la trae). */
  getById: async (id: number): Promise<Recuperador> => (await api.get<Recuperador>(`/recuperadores/${id}`)).data,
  create: async (input: CreateRecuperadorInput): Promise<Recuperador> =>
    (await api.post<Recuperador>('/recuperadores', await prepararRecuperador(input))).data,
  update: async (id: number, input: UpdateRecuperadorInput): Promise<Recuperador> =>
    (await api.patch<Recuperador>(`/recuperadores/${id}`, await prepararRecuperador(input))).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/recuperadores/${id}`)
  },
  getByCedula: async (cedula: string): Promise<Recuperador> =>
    (await api.get<Recuperador>(`/recuperadores/cedula/${encodeURIComponent(cedula)}`)).data,
}
