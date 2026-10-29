import type { CreateReporteInput, Reporte, UpdateReporteInput } from '@/types/api'
import { api } from './api'

export interface ReportesConsulta {
  ventaDesde?: string
  ventaHasta?: string
  registroDesde?: string
  registroHasta?: string
  cedula?: string
  id_eca?: number
  id_mat?: number
}

export const reportesService = {
  balanceMasas: async (filtros: ReportesConsulta): Promise<Reporte[]> => {
    const rows: Reporte[] = []
    let page: Reporte[]
    do {
      page = (await api.get<Reporte[]>('/reportes/balance-masas', { params: { ...filtros, limit: 200, offset: rows.length } })).data
      rows.push(...page)
    } while (page.length === 200)
    return rows
  },
  nextPrefacturaNumber: async (): Promise<number> =>
    (await api.post<{ numero_prefactura: number }>('/reportes/prefacturas/consecutivo')).data.numero_prefactura,
  listAll: async (filtros: ReportesConsulta = {}): Promise<Reporte[]> => {
    const rows: Reporte[] = []
    let page: Reporte[]
    do {
      page = (await api.get<Reporte[]>('/reportes', { params: { ...filtros, limit: 200, offset: rows.length } })).data
      rows.push(...page)
    } while (page.length === 200)
    return rows
  },
  list: async (limit = 50): Promise<Reporte[]> => (await api.get<Reporte[]>('/reportes', { params: { limit } })).data,
  create: async (input: CreateReporteInput): Promise<Reporte> => (await api.post<Reporte>('/reportes', input)).data,
  createBatch: async (registros: CreateReporteInput[]): Promise<Reporte[]> => (await api.post<Reporte[]>('/reportes/lote', { registros })).data,
  comprobante: async (id: number): Promise<Reporte[]> => (await api.get<Reporte[]>(`/reportes/${id}/comprobante`)).data,
  update: async (id: number, input: UpdateReporteInput): Promise<Reporte> => (await api.put<Reporte>(`/reportes/${id}`, input)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/reportes/${id}`)
  },
}
