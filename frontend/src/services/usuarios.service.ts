import type { Cargo, CreateUsuarioInput, Rol, Usuario } from '@/types/api'
import { api } from './api'

export const usuariosService = {
  list: async (): Promise<Usuario[]> => (await api.get<Usuario[]>('/usuarios')).data,
  create: async (input: CreateUsuarioInput): Promise<Usuario> => (await api.post<Usuario>('/usuarios', input)).data,
  update: async (id: number, input: Partial<CreateUsuarioInput>): Promise<Usuario> =>
    (await api.patch<Usuario>(`/usuarios/${id}`, input)).data,
  remove: async (id: number): Promise<void> => {
    await api.delete(`/usuarios/${id}`)
  },
  setActivo: async (id: number, activo: boolean): Promise<Usuario> =>
    (await api.patch<Usuario>(`/usuarios/${id}`, { activo })).data,
  roles: async (): Promise<Rol[]> => (await api.get<Rol[]>('/catalogos/roles')).data,
  cargos: async (): Promise<Cargo[]> => (await api.get<Cargo[]>('/catalogos/cargos')).data,
}
