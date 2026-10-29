import type { Perfil } from '@/types/api'

export const ALL_PERFILES: Perfil[] = ['Administrador', 'Coordinador', 'Operario', 'Administrador Eca']

/** Matriz de acceso de la interfaz (el backend aplica las mismas reglas de forma obligatoria). */
export const ACCESS = {
  crearReporte: ALL_PERFILES,
  /** Pestaña «Editar Información» de Crear Reporte: el Administrador Eca solo crea reportes. */
  reportesGuardados: ['Administrador', 'Coordinador', 'Operario'],
  consultarReporte: ['Administrador', 'Coordinador'],
  prefacturar: ['Administrador', 'Coordinador'],
  balanceMasas: ['Administrador', 'Coordinador'],
  caracterizar: ['Administrador', 'Coordinador'],
  caracterizarEscritura: ['Administrador', 'Coordinador'],
  editarReporte: ['Administrador', 'Coordinador'],
  eliminar: ['Administrador'],
  usuarios: ['Administrador', 'Coordinador'],
} as const satisfies Record<string, readonly Perfil[]>

export const canAccess = (perfil: Perfil | null | undefined, allowed: readonly Perfil[]): boolean =>
  !!perfil && allowed.includes(perfil)

/** Presentación inicial compartida por todos los perfiles. */
export function homeFor(_perfil: Perfil | null | undefined): string {
  return '/'
}
