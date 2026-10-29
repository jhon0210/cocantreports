import { z } from 'zod'
import { todayISO } from '@/lib/format'
import {
  AFILIACIONES_SALUD,
  ESTADOS_CIVILES,
  ESTRATOS,
  GENEROS,
  GRUPOS_RH,
  JORNADAS,
  LUGARES_RECOLECCION,
  MATERIALES_RECUPERADOS,
  NIVELES_EDUCATIVOS,
  PERTENENCIAS_ETNICAS,
  TIPOS_DOCUMENTO,
  TRANSPORTES,
  USOS_EPP,
} from './opciones'

const cedula = z
  .string()
  .trim()
  .min(1, 'Ingresa el número de documento')
  .regex(/^\d+$/, 'El número de documento solo debe contener números')
  .min(5, 'El número de documento debe tener al menos 5 dígitos')
  .max(15, 'El número de documento no puede superar 15 dígitos')

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)
const opcion = (valores: readonly string[]) => z.string().refine((v) => v === '' || valores.includes(v), 'Selecciona una opción válida')
const lista = (valores: readonly string[]) => z.array(z.string().refine((v) => valores.includes(v), 'Opción no válida'))
const fecha = z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Ingresa una fecha válida')
const entero = (max: number) =>
  z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= max), `Ingresa un número entre 0 y ${max}`)

const recuperadorShape = {
  nombre: z.string().trim().min(1, 'Ingresa el nombre').max(100, 'Máximo 100 caracteres'),
  apellido: z.string().trim().min(1, 'Ingresa el apellido').max(100, 'Máximo 100 caracteres'),
  cedula,
  id_estado: z.string().min(1, 'Selecciona el estado'),
  bancarizado: z.boolean(),
  foto: z.string().min(1, 'Toma o sube la foto del recuperador'),
  codigo_registro: z.string().trim().refine((v) => v === '' || /^[A-Za-z0-9._/-]{1,40}$/.test(v), 'Usa hasta 40 letras, números, punto, guion o barra'),
  fecha_inscripcion: fecha,
  lugar: texto(150),
  pertenece_organizacion: z.boolean(),
  organizacion_nombre: texto(150),
  organizacion_nit: texto(30),
  tipo_documento: opcion(TIPOS_DOCUMENTO),
  tipo_documento_otro: texto(60),
  fecha_nacimiento: fecha,
  genero: opcion(GENEROS),
  rh: opcion(GRUPOS_RH),
  direccion: texto(200),
  barrio: texto(150),
  comuna: texto(150),
  estrato: opcion(ESTRATOS),
  telefono: z.string().trim().refine((v) => v === '' || /^[0-9+()\s-]{7,20}$/.test(v), 'Ingresa un teléfono válido (7 a 20 caracteres numéricos)'),
  estado_civil: opcion(ESTADOS_CIVILES),
  nivel_educativo: opcion(NIVELES_EDUCATIVOS),
  pertenencia_etnica: opcion(PERTENENCIAS_ETNICAS),
  discapacidad: z.boolean(),
  discapacidad_tipo: texto(150),
  victima_conflicto: z.boolean(),
  ruv: z.boolean(),
  salud: opcion(AFILIACIONES_SALUD),
  dependientes_total: entero(99),
  dependientes_menores: entero(99),
  dependientes_adultos_mayores: entero(99),
  dependientes_discapacidad: entero(99),
  experiencia_anios: entero(80),
  jornada: opcion(JORNADAS),
  lugar_recoleccion: opcion(LUGARES_RECOLECCION),
  microruta: texto(150),
  microruta_direccion_inicial: texto(200),
  microruta_direccion_final: texto(200),
  transporte: lista(TRANSPORTES),
  transporte_otro: texto(150),
  placa_habitual: z.string().trim().toUpperCase().refine((v) => v === '' || /^[A-Z0-9-]{3,15}$/.test(v), 'Usa de 3 a 15 letras, números o guiones'),
  epp: opcion(USOS_EPP),
  materiales: lista(MATERIALES_RECUPERADOS),
  materiales_otros: texto(150),
  autoriza_datos: z.boolean(),
}

/** La autorización de datos solo se exige al registrar; al editar se conserva lo ya declarado. */
const buildRecuperadorSchema = (creating: boolean) =>
  z.object(recuperadorShape).superRefine((v, ctx) => {
    const hoy = todayISO()
    const error = (path: keyof typeof recuperadorShape, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    if (!v.fecha_inscripcion) error('fecha_inscripcion', 'Ingresa la fecha de inscripción')
    else if (v.fecha_inscripcion > hoy) error('fecha_inscripcion', 'La fecha de inscripción no puede ser futura')
    if (!v.tipo_documento) error('tipo_documento', 'Selecciona el tipo de documento')
    if (v.tipo_documento === 'Otro' && !v.tipo_documento_otro) error('tipo_documento_otro', 'Especifica el tipo de documento')
    if (v.fecha_nacimiento) {
      if (v.fecha_nacimiento > hoy) error('fecha_nacimiento', 'La fecha de nacimiento no puede ser futura')
      else if (Number(v.fecha_nacimiento.slice(0, 4)) < Number(hoy.slice(0, 4)) - 120) error('fecha_nacimiento', 'La fecha de nacimiento no es válida')
    }
    if (v.pertenece_organizacion && !v.organizacion_nombre) error('organizacion_nombre', 'Indica el nombre de la organización')
    if (v.discapacidad && !v.discapacidad_tipo) error('discapacidad_tipo', 'Especifica el tipo de discapacidad')
    if (v.transporte.includes('Otro') && !v.transporte_otro) error('transporte_otro', 'Especifica el otro medio de transporte')
    if (v.materiales.includes('Otros') && !v.materiales_otros) error('materiales_otros', 'Especifica los otros materiales')
    if (creating && !v.autoriza_datos) error('autoriza_datos', 'Debes aceptar la declaración y autorización para registrar')
  })

export const recuperadorSchema = buildRecuperadorSchema(true)
export const editarRecuperadorSchema = buildRecuperadorSchema(false)

export type RecuperadorValues = z.infer<typeof recuperadorSchema>

export const ecaSchema = z.object({
  nomEca: z.string().trim().min(1, 'Ingresa el nombre de la ECA').max(120, 'Máximo 120 caracteres'),
  direccion: z.string().trim().min(1, 'Ingresa la dirección').max(200, 'Máximo 200 caracteres'),
  representante: z.string().trim().min(1, 'Ingresa el representante legal o responsable').max(150, 'Máximo 150 caracteres'),
  codigo_nuec: z.string().trim().max(80, 'Máximo 80 caracteres'),
})

export type EcaValues = z.infer<typeof ecaSchema>
