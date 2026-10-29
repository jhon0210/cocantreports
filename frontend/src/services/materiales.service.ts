import type { Material } from '@/types/api'
import { api } from './api'

export const materialesService = {
  list: async (): Promise<Material[]> => (await api.get<Material[]>('/materiales')).data,
}
