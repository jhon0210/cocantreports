import { api } from './api'

export interface CapturaBalance {
  periodo: string
  id_eca: number
  id_mat: number
  inventario_inicial_kg: number
  salidas_kg: number
  rechazos_kg: number
  entradas_cat_kg: number | null
  entradas_al_guardar_kg: number
  soporte_salidas: string | null
  receptor_rechazos: string | null
  observaciones: string | null
  id_user: number
  version: number
  actualizado_en: string
}

export interface ResumenBalance {
  id_eca: number
  id_mat: number
  eca: string | null
  material: string | null
  codigo: number | null
  entradas_kg: number
  captura: CapturaBalance | null
  anterior: { entradas_kg: number; captura: CapturaBalance } | null
  inventario_anterior_kg: number | null
  inventario_final_kg: number | null
  novedades: string[]
}

export interface GuardarBalanceInput {
  periodo: string
  id_eca: number
  id_mat: number
  inventario_inicial_kg: number
  salidas_kg: number
  rechazos_kg: number
  entradas_cat_kg: number | null
  entradas_esperadas_kg: number
  soporte_salidas: string | null
  receptor_rechazos: string | null
  observaciones: string | null
  version: number | null
  mediciones_confirmadas: boolean
}

export const balanceMasasService = {
  consultar: async (periodo: string, id_eca?: number): Promise<ResumenBalance[]> =>
    (await api.get<ResumenBalance[]>('/balance-masas', { params: { periodo, id_eca } })).data,
  guardar: async (input: GuardarBalanceInput): Promise<void> => { await api.put('/balance-masas', input) },
}
