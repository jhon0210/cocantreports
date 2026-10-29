import { calcularEdad, emptyValues, toCaracterizacion, toInput, toValues } from './caracterizacion'
import { editarRecuperadorSchema, recuperadorSchema } from './schemas'
import type { Recuperador } from '@/types/api'

const rellenar = () => ({
  ...emptyValues(), nombre: 'Ana', apellido: 'Pérez', cedula: '1090000010', foto: 'data:image/png;base64,AAAA', autoriza_datos: true,
})

const mensajes = (result: ReturnType<typeof recuperadorSchema.safeParse>) =>
  result.success ? [] : [...new Set(result.error.issues.map((i) => String(i.path[0])))]

describe('caracterización del recuperador', () => {
  it('conserva una placa habitual opcional y no inventa la de quien no la tiene', () => {
    const parsed = recuperadorSchema.parse({ ...rellenar(), placa_habitual: ' abc123 ' })
    expect(toCaracterizacion(parsed).placa_habitual).toBe('ABC123')
    expect(toCaracterizacion(rellenar()).placa_habitual).toBeUndefined()
    expect(recuperadorSchema.safeParse({ ...rellenar(), placa_habitual: '<placa>' }).success).toBe(false)
  })
  it('el formulario vacío solo falla por lo obligatorio', () => {
    const faltantes = mensajes(recuperadorSchema.safeParse(emptyValues())).map((m) => m.split(':')[0])
    expect(faltantes.sort()).toEqual(['apellido', 'autoriza_datos', 'cedula', 'foto', 'nombre'])
  })

  it('un registro mínimo válido se acepta', () => {
    expect(recuperadorSchema.safeParse(rellenar()).success).toBe(true)
  })

  it('exige los campos dependientes de la opción elegida', () => {
    const v = {
      ...rellenar(), tipo_documento: 'Otro', pertenece_organizacion: true, discapacidad: true,
      transporte: ['Otro'], materiales: ['Otros'], fecha_nacimiento: '2999-01-01',
    }
    expect(mensajes(recuperadorSchema.safeParse(v)).map((m) => m.split(':')[0]).sort()).toEqual([
      'discapacidad_tipo', 'fecha_nacimiento', 'materiales_otros', 'organizacion_nombre', 'tipo_documento_otro', 'transporte_otro',
    ])
  })

  it('la autorización solo se exige al registrar, no al editar', () => {
    const v = { ...rellenar(), autoriza_datos: false }
    expect(recuperadorSchema.safeParse(v).success).toBe(false)
    expect(editarRecuperadorSchema.safeParse(v).success).toBe(true)
  })

  it('rechaza números y teléfonos fuera de rango', () => {
    const v = { ...rellenar(), dependientes_total: '100', experiencia_anios: '81', telefono: 'abc' }
    expect(mensajes(recuperadorSchema.safeParse(v)).map((m) => m.split(':')[0]).sort()).toEqual(['dependientes_total', 'experiencia_anios', 'telefono'])
  })

  it('omite lo vacío y lo dependiente de una opción apagada al enviar', () => {
    const c = toCaracterizacion({
      ...rellenar(), organizacion_nombre: 'Coop', discapacidad_tipo: 'Visual', ruv: true, transporte_otro: 'x', materiales_otros: 'y',
      dependientes_total: '3', dependientes_menores: '0', experiencia_anios: '',
    })
    expect(c).toMatchObject({ pertenece_organizacion: false, discapacidad: false, victima_conflicto: false, dependientes_total: 3, dependientes_menores: 0, autoriza_datos: true })
    for (const clave of ['organizacion_nombre', 'discapacidad_tipo', 'ruv', 'transporte_otro', 'materiales_otros', 'experiencia_anios', 'lugar', 'transporte']) {
      expect(c).not.toHaveProperty(clave, expect.anything())
    }
    expect(toInput({ ...rellenar(), codigo_registro: '  ' }).codigo_registro).toBeNull()
  })

  it('un recuperador anterior al formato se edita con su fecha de registro y sin datos inventados', () => {
    const antiguo = {
      id_recuperador: 1, nombre: 'Juan', apellido: 'Pérez', cedula: '1090000001', bancarizado: true, foto: null, tiene_foto: false,
      codigo_registro: null, caracterizacion: null, FechaRegistro: '2026-03-01', id_estado: 1, estado: 'Activo',
    } satisfies Recuperador
    expect(toValues(antiguo)).toMatchObject({ fecha_inscripcion: '2026-03-01', tipo_documento: '', genero: '', transporte: [], autoriza_datos: false })
  })

  it('calcula la edad según el cumpleaños', () => {
    expect(calcularEdad('1980-05-20', '2026-05-19')).toBe(45)
    expect(calcularEdad('1980-05-20', '2026-05-20')).toBe(46)
    expect(calcularEdad('2999-01-01', '2026-05-20')).toBeNull()
    expect(calcularEdad('', '2026-05-20')).toBeNull()
  })
})
