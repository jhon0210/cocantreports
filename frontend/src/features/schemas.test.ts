import { loginSchema } from '@/features/auth/schemas'
import { ecaSchema, recuperadorSchema } from '@/features/caracterizar/schemas'
import { emptyValues } from '@/features/caracterizar/caracterizacion'
import { cedulaSchema, reporteSchema } from '@/features/reportes/schemas'
import { usuarioSchema } from '@/features/usuarios/schemas'

const messages = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map((i) => i.message) ?? []

describe('reporteSchema', () => {
  const valido = { id_mat: '1', id_eca: '2', cantidad: 12.5, valor: 800, FechaVenta: '' }

  it('acepta una venta válida (con y sin fecha)', () => {
    expect(reporteSchema.safeParse(valido).success).toBe(true)
    expect(reporteSchema.safeParse({ ...valido, FechaVenta: undefined }).success).toBe(true)
  })

  it('exige material, cantidad y valor', () => {
    expect(messages(reporteSchema.safeParse({ ...valido, id_mat: '' }))).toContain('Selecciona el código del material')
    expect(messages(reporteSchema.safeParse({ ...valido, id_eca: '' }))).toContain('Selecciona la ECA donde vendió')
    expect(messages(reporteSchema.safeParse({ ...valido, cantidad: NaN }))).toContain('Ingresa la cantidad vendida')
    expect(messages(reporteSchema.safeParse({ ...valido, valor: undefined }))).toContain('Ingresa el valor unitario')
  })

  it('cantidad permite cero, rechaza negativos y el valor debe ser mayor que cero', () => {
    expect(reporteSchema.safeParse({ ...valido, cantidad: 0 }).success).toBe(true)
    expect(messages(reporteSchema.safeParse({ ...valido, cantidad: -1 }))).toContain('La cantidad debe ser mayor o igual que 0')
    expect(messages(reporteSchema.safeParse({ ...valido, valor: 0 }))).toContain('El valor debe ser mayor que 0')
    expect(messages(reporteSchema.safeParse({ ...valido, valor: 10.5 }))).toContain('El valor debe ser un número entero')
  })

  it('rechaza fechas futuras', () => {
    expect(reporteSchema.safeParse({ ...valido, FechaVenta: '2999-01-01' }).success).toBe(false)
  })
})

describe('cedulaSchema', () => {
  it.each([
    ['1090000001', true],
    ['  1090000001 ', true],
    ['1234', false],
    ['abc12345', false],
    ['1'.repeat(16), false],
    ['', false],
  ])('%j -> %s', (cedula, ok) => {
    expect(cedulaSchema.safeParse({ cedula }).success).toBe(ok)
  })
})

describe('recuperadorSchema', () => {
  const base = {
    ...emptyValues(), nombre: 'Juan', apellido: 'Pérez', cedula: '1090000010', id_estado: '1', bancarizado: false,
    foto: 'data:image/jpeg;base64,AAAA', autoriza_datos: true,
  }

  it('acepta datos completos', () => {
    expect(recuperadorSchema.safeParse(base).success).toBe(true)
  })

  it('exige la foto y el estado (ya no hay ECA)', () => {
    expect(messages(recuperadorSchema.safeParse({ ...base, foto: '' }))).toContain('Toma o sube la foto del recuperador')
    expect(messages(recuperadorSchema.safeParse({ ...base, id_estado: '' }))).toContain('Selecciona el estado')
  })
})

describe('ecaSchema', () => {
  it('exige organización, responsable y dirección; el código NUEC es opcional', () => {
    const vacio = { nomEca: '', direccion: '', representante: '', codigo_nuec: '' }
    expect(ecaSchema.safeParse(vacio).error?.issues).toHaveLength(3)
    expect(ecaSchema.safeParse({ ...vacio, nomEca: 'A', direccion: 'B', representante: 'Ana' }).success).toBe(true)
  })
})

describe('usuarioSchema', () => {
  const base = { nomUser: 'A', apeUser: 'B', usuario: 'user.1', clave: 'Clave1234', cedula: '12345678', id_perfil: '3', id_cargo: '', id_eca: '' }

  it('valida la política de clave', () => {
    expect(usuarioSchema.safeParse(base).success).toBe(true)
    expect(usuarioSchema.safeParse({ ...base, clave: 'corta1A' }).success).toBe(false)
    expect(usuarioSchema.safeParse({ ...base, clave: 'sinmayuscula1' }).success).toBe(false)
    expect(usuarioSchema.safeParse({ ...base, clave: 'SINMINUSCULA1' }).success).toBe(false)
    expect(usuarioSchema.safeParse({ ...base, clave: 'SinNumeros' }).success).toBe(false)
  })

  it('valida usuario y rango de cédula', () => {
    expect(usuarioSchema.safeParse({ ...base, usuario: 'a b' }).success).toBe(false)
    expect(usuarioSchema.safeParse({ ...base, cedula: '9999999999' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('requiere usuario y clave', () => {
    expect(loginSchema.safeParse({ usuario: '', clave: '' }).error?.issues).toHaveLength(2)
    expect(loginSchema.safeParse({ usuario: 'operario1', clave: 'x' }).success).toBe(true)
  })
})
