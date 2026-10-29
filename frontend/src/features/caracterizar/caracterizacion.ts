import { todayISO } from '@/lib/format'
import type { Caracterizacion, CreateRecuperadorInput, Recuperador } from '@/types/api'
import type { RecuperadorValues } from './schemas'

export const ACTIVO_ID = '1'

export const emptyValues = (): RecuperadorValues => ({
  nombre: '',
  apellido: '',
  cedula: '',
  id_estado: ACTIVO_ID,
  bancarizado: false,
  foto: '',
  codigo_registro: '',
  fecha_inscripcion: todayISO(),
  lugar: '',
  pertenece_organizacion: false,
  organizacion_nombre: '',
  organizacion_nit: '',
  tipo_documento: 'CC',
  tipo_documento_otro: '',
  fecha_nacimiento: '',
  genero: '',
  rh: '',
  direccion: '',
  barrio: '',
  comuna: '',
  estrato: '',
  telefono: '',
  estado_civil: '',
  nivel_educativo: '',
  pertenencia_etnica: '',
  discapacidad: false,
  discapacidad_tipo: '',
  victima_conflicto: false,
  ruv: false,
  salud: '',
  dependientes_total: '',
  dependientes_menores: '',
  dependientes_adultos_mayores: '',
  dependientes_discapacidad: '',
  experiencia_anios: '',
  jornada: '',
  lugar_recoleccion: '',
  microruta: '',
  microruta_direccion_inicial: '',
  microruta_direccion_final: '',
  transporte: [],
  transporte_otro: '',
  placa_habitual: '',
  epp: '',
  materiales: [],
  materiales_otros: '',
  autoriza_datos: false,
})

const num = (v: number | undefined): string => (v === undefined ? '' : String(v))

export function toValues(r: Recuperador): RecuperadorValues {
  const c: Caracterizacion = r.caracterizacion ?? {}
  return {
    nombre: r.nombre,
    apellido: r.apellido,
    cedula: r.cedula,
    id_estado: String(r.id_estado),
    bancarizado: r.bancarizado,
    foto: r.foto ?? '',
    codigo_registro: r.codigo_registro ?? '',
    // Los recuperadores anteriores al formato conservan su fecha de registro como fecha de inscripción.
    fecha_inscripcion: c.fecha_inscripcion ?? r.FechaRegistro,
    lugar: c.lugar ?? '',
    pertenece_organizacion: c.pertenece_organizacion ?? false,
    organizacion_nombre: c.organizacion_nombre ?? '',
    organizacion_nit: c.organizacion_nit ?? '',
    tipo_documento: c.tipo_documento ?? '',
    tipo_documento_otro: c.tipo_documento_otro ?? '',
    fecha_nacimiento: c.fecha_nacimiento ?? '',
    genero: c.genero ?? '',
    rh: c.rh ?? '',
    direccion: c.direccion ?? '',
    barrio: c.barrio ?? '',
    comuna: c.comuna ?? '',
    estrato: c.estrato ?? '',
    telefono: c.telefono ?? '',
    estado_civil: c.estado_civil ?? '',
    nivel_educativo: c.nivel_educativo ?? '',
    pertenencia_etnica: c.pertenencia_etnica ?? '',
    discapacidad: c.discapacidad ?? false,
    discapacidad_tipo: c.discapacidad_tipo ?? '',
    victima_conflicto: c.victima_conflicto ?? false,
    ruv: c.ruv ?? false,
    salud: c.salud ?? '',
    dependientes_total: num(c.dependientes_total),
    dependientes_menores: num(c.dependientes_menores),
    dependientes_adultos_mayores: num(c.dependientes_adultos_mayores),
    dependientes_discapacidad: num(c.dependientes_discapacidad),
    experiencia_anios: num(c.experiencia_anios),
    jornada: c.jornada ?? '',
    lugar_recoleccion: c.lugar_recoleccion ?? '',
    microruta: c.microruta ?? '',
    microruta_direccion_inicial: c.microruta_direccion_inicial ?? '',
    microruta_direccion_final: c.microruta_direccion_final ?? '',
    transporte: c.transporte ?? [],
    transporte_otro: c.transporte_otro ?? '',
    placa_habitual: c.placa_habitual ?? '',
    epp: c.epp ?? '',
    materiales: c.materiales ?? [],
    materiales_otros: c.materiales_otros ?? '',
    autoriza_datos: c.autoriza_datos ?? false,
  }
}

const optional = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim())
const optionalNumber = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v))

/** Convierte las respuestas del formulario al formato de la API omitiendo lo que se dejó vacío. */
export function toCaracterizacion(v: RecuperadorValues): Caracterizacion {
  return {
    fecha_inscripcion: optional(v.fecha_inscripcion),
    lugar: optional(v.lugar),
    pertenece_organizacion: v.pertenece_organizacion,
    organizacion_nombre: v.pertenece_organizacion ? optional(v.organizacion_nombre) : undefined,
    organizacion_nit: v.pertenece_organizacion ? optional(v.organizacion_nit) : undefined,
    tipo_documento: optional(v.tipo_documento),
    tipo_documento_otro: v.tipo_documento === 'Otro' ? optional(v.tipo_documento_otro) : undefined,
    fecha_nacimiento: optional(v.fecha_nacimiento),
    genero: optional(v.genero),
    rh: optional(v.rh),
    direccion: optional(v.direccion),
    barrio: optional(v.barrio),
    comuna: optional(v.comuna),
    estrato: optional(v.estrato),
    telefono: optional(v.telefono),
    estado_civil: optional(v.estado_civil),
    nivel_educativo: optional(v.nivel_educativo),
    pertenencia_etnica: optional(v.pertenencia_etnica),
    discapacidad: v.discapacidad,
    discapacidad_tipo: v.discapacidad ? optional(v.discapacidad_tipo) : undefined,
    victima_conflicto: v.victima_conflicto,
    ruv: v.victima_conflicto ? v.ruv : undefined,
    salud: optional(v.salud),
    dependientes_total: optionalNumber(v.dependientes_total),
    dependientes_menores: optionalNumber(v.dependientes_menores),
    dependientes_adultos_mayores: optionalNumber(v.dependientes_adultos_mayores),
    dependientes_discapacidad: optionalNumber(v.dependientes_discapacidad),
    experiencia_anios: optionalNumber(v.experiencia_anios),
    jornada: optional(v.jornada),
    lugar_recoleccion: optional(v.lugar_recoleccion),
    microruta: optional(v.microruta),
    microruta_direccion_inicial: optional(v.microruta_direccion_inicial),
    microruta_direccion_final: optional(v.microruta_direccion_final),
    transporte: v.transporte.length ? v.transporte : undefined,
    transporte_otro: v.transporte.includes('Otro') ? optional(v.transporte_otro) : undefined,
    placa_habitual: optional(v.placa_habitual)?.toUpperCase(),
    epp: optional(v.epp),
    materiales: v.materiales.length ? v.materiales : undefined,
    materiales_otros: v.materiales.includes('Otros') ? optional(v.materiales_otros) : undefined,
    autoriza_datos: v.autoriza_datos,
  }
}

export const toInput = (v: RecuperadorValues): CreateRecuperadorInput => ({
  nombre: v.nombre,
  apellido: v.apellido,
  cedula: v.cedula,
  id_estado: Number(v.id_estado),
  bancarizado: v.bancarizado,
  foto: v.foto,
  codigo_registro: optional(v.codigo_registro) ?? null,
  caracterizacion: toCaracterizacion(v),
})

/** Edad en años cumplidos a la fecha indicada; null si la fecha de nacimiento no es válida. */
export function calcularEdad(nacimiento: string, hoy: string = todayISO()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || nacimiento > hoy) return null
  const [y, m, d] = nacimiento.split('-').map(Number)
  const [hy, hm, hd] = hoy.split('-').map(Number)
  return hy - y - (hm < m || (hm === m && hd < d) ? 1 : 0)
}
