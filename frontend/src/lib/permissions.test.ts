import { ACCESS, canAccess } from './permissions'
import type { Perfil } from '@/types/api'

describe('matriz de permisos', () => {
  it('el Administrador tiene acceso a todas las acciones', () => {
    for (const allowed of Object.values(ACCESS)) {
      expect(canAccess('Administrador', allowed)).toBe(true)
    }
  })

  it('el Coordinador consulta, crea y edita en todos los módulos, sin eliminar', () => {
    for (const [action, allowed] of Object.entries(ACCESS)) {
      expect(canAccess('Coordinador', allowed)).toBe(action !== 'eliminar')
    }
  })

  it('el Operario solo puede acceder a Crear Reporte y a sus registros guardados', () => {
    for (const [action, allowed] of Object.entries(ACCESS)) {
      expect(canAccess('Operario', allowed)).toBe(action === 'crearReporte' || action === 'reportesGuardados')
    }
  })

  it('el Administrador Eca solo puede crear reportes, sin acceder a los guardados', () => {
    for (const [action, allowed] of Object.entries(ACCESS)) {
      expect(canAccess('Administrador Eca', allowed)).toBe(action === 'crearReporte')
    }
  })

  it.each([null, undefined] as const)('sin perfil (%s) no se concede acceso', (perfil: Perfil | null | undefined) => {
    for (const allowed of Object.values(ACCESS)) {
      expect(canAccess(perfil, allowed)).toBe(false)
    }
  })
})
