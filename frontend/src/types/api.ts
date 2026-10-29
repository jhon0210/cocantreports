/**
 * Tipos de la API. Reflejan los DTOs de respuesta del backend (ver Swagger en /api/docs).
 * Si cambian los DTOs del backend, actualiza este archivo.
 */

export type Perfil = 'Administrador' | 'Coordinador' | 'Operario' | 'Administrador Eca'

export interface Usuario {
  id_user: number
  nomUser: string
  apeUser: string
  usuario: string
  cedula: number | null
  id_perfil: number | null
  perfil: Perfil | null
  id_cargo: number | null
  cargo: string | null
  id_eca: number | null
  eca: string | null
  activo: boolean
}

export interface AuthResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: Usuario
}

export interface Rol {
  id_perfil: number
  perfil: Perfil
}

export interface Cargo {
  id_cargo: number
  cargo: string
  estado: string | null
}

export interface Material {
  id_mat: number
  codigo: number | null
  nomMaterial: string | null
}

export interface Eca {
  id_eca: number
  nomEca: string | null
  direccion: string | null
  comuna: string | null
  estado: string | null
  categoria: string | null
  ruta: string | null
  macroruta: string | null
  representante: string | null
  codigo_nuec: string | null
  adjuntos: EcaAdjunto[]
}

export interface EcaAdjunto {
  id: number
  nombre: string
  tamano: number
}

export type EcaAdjuntoInput = { id: number } | { nombre: string; contenido: string }

export interface EstadoRecuperador {
  id_estado: number
  nombre: string
}

/** Nombres de estado de los que depende la interfaz (los ids/nombres viven en la tabla estados_recuperador). */
export const ESTADO_ACTIVO = 'Activo'

export interface Caracterizacion {
  fecha_inscripcion?: string
  lugar?: string
  pertenece_organizacion?: boolean
  organizacion_nombre?: string
  organizacion_nit?: string
  tipo_documento?: string
  tipo_documento_otro?: string
  fecha_nacimiento?: string
  genero?: string
  rh?: string
  direccion?: string
  barrio?: string
  comuna?: string
  estrato?: string
  telefono?: string
  estado_civil?: string
  nivel_educativo?: string
  pertenencia_etnica?: string
  discapacidad?: boolean
  discapacidad_tipo?: string
  victima_conflicto?: boolean
  ruv?: boolean
  salud?: string
  dependientes_total?: number
  dependientes_menores?: number
  dependientes_adultos_mayores?: number
  dependientes_discapacidad?: number
  experiencia_anios?: number
  jornada?: string
  lugar_recoleccion?: string
  microruta?: string
  microruta_direccion_inicial?: string
  microruta_direccion_final?: string
  transporte?: string[]
  transporte_otro?: string
  placa_habitual?: string
  epp?: string
  materiales?: string[]
  materiales_otros?: string
  autoriza_datos?: boolean
}

export interface Recuperador {
  documentos?: DocumentoRecuperador[]
  id_recuperador: number
  nombre: string
  apellido: string
  cedula: string
  bancarizado: boolean
  foto: string | null
  tiene_foto: boolean
  codigo_registro: string | null
  /** Null en los recuperadores registrados antes del formato de inscripción. */
  caracterizacion: Caracterizacion | null
  FechaRegistro: string
  id_estado: number
  estado: string
}

export interface Reporte {
  id_eca_macroruta?: number | null
  macroruta?: { codigo: string | null; nombre: string | null } | null
  consecutivo: number
  comprobante: string | null
  numero_reporte: number
  id_mat: number
  material: { codigo: number | null; nomMaterial: string | null }
  cantidad: number
  valor: number
  subtotal: number
  id_user: number
  usuario: { nomUser: string | null; apeUser: string | null; usuario: string | null }
  id_eca: number
  eca: { nomEca: string | null; direccion: string | null; comuna: string | null; codigo_nuec?: string | null }
  id_recuperador: number | null
  recuperador: { nombre: string; apellido: string; cedula: string; tipo_documento?: string | null; placa_habitual?: string | null } | null
  FechaRegistro: string
  FechaVenta: string
}

export interface CreateReporteInput {
  id_eca_macroruta?: number | null
  id_recuperador: number
  id_mat: number
  cantidad: number
  valor: number
  id_eca: number
  FechaVenta?: string
}

export type UpdateReporteInput = Omit<CreateReporteInput, 'id_recuperador'>

export interface CreateRecuperadorInput {
  documentos?: DocumentoRecuperadorInput[]
  nombre: string
  apellido: string
  cedula: string
  id_estado?: number
  bancarizado: boolean
  foto?: string
  codigo_registro?: string | null
  caracterizacion?: Caracterizacion
}

export type UpdateRecuperadorInput = Partial<CreateRecuperadorInput>

export interface DocumentoRecuperador {
  id: number
  tipo: string
  nombre: string
  mime: string
  tamano: number
}

export type DocumentoRecuperadorInput = { id: number } | {
  tipo: string
  nombre: string
  contenido: string
}

export interface CreateEcaInput {
  nomEca: string
  direccion: string
  ruta?: string
  macroruta?: string
  comuna?: string
  estado?: string
  categoria?: string
  representante?: string
  codigo_nuec?: string
  adjuntos?: EcaAdjuntoInput[]
}

export interface CreateUsuarioInput {
  nomUser: string
  apeUser: string
  usuario: string
  clave: string
  cedula: number
  id_perfil: number
  id_cargo?: number
  id_eca?: number
}
