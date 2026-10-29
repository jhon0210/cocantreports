import { ValidationError } from '../shared/domain-errors';

export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'Pasaporte', 'NIT', 'PPT', 'Otro'] as const;
export const GENEROS = ['Femenino', 'Masculino', 'No binario / Otro'] as const;
export const GRUPOS_RH = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export const ESTRATOS = ['1', '2', '3', 'Sin estrato / Rural'] as const;
export const ESTADOS_CIVILES = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Viudo(a)', 'Separado(a)'] as const;
export const NIVELES_EDUCATIVOS = [
  'Ninguno',
  'Primaria incompleta',
  'Primaria completa',
  'Secundaria incompleta',
  'Secundaria completa',
  'Técnico / Tecnólogo',
  'Superior',
] as const;
export const PERTENENCIAS_ETNICAS = [
  'Indígena',
  'Afrodescendiente / Negro(a) / Mulato(a)',
  'Raizal',
  'Palenquero',
  'Gitano(a)',
  'Ninguna',
] as const;
export const AFILIACIONES_SALUD = ['Contributivo', 'Subsidiado (SISBEN)', 'No afiliado'] as const;
export const JORNADAS = ['Diurna', 'Nocturna', 'Mixta'] as const;
export const LUGARES_RECOLECCION = [
  'Vía pública / Calles',
  'Contenedores o puntos de almacenamiento',
  'Grandes generadores (comercial/industrial)',
  'Estación de Clasificación y Aprovechamiento (ECA)',
] as const;
export const TRANSPORTES = ['A pie / Costal o bulto', 'Carretilla manual', 'Motocarro', 'Vehículo automotor', 'Otro'] as const;
export const USOS_EPP = ['Siempre', 'A veces', 'Nunca'] as const;
export const MATERIALES_RECUPERADOS = [
  'Papel y Cartón',
  'Plástico (PET, PEAD, PEBD, PVC, etc.)',
  'Vidrio',
  'Metales (Hierro, cobre, aluminio, bronce, acero)',
  'Multicapas / Envases tipo Tetrapak',
  'RAEE (Residuos de Aparatos Eléctricos y Electrónicos)',
  'Otros',
] as const;

/** Respuestas del formato de inscripción y caracterización. Los campos dependientes solo existen si su condición se cumple. */
export interface Caracterizacion {
  fecha_inscripcion?: string;
  lugar?: string;
  pertenece_organizacion?: boolean;
  organizacion_nombre?: string;
  organizacion_nit?: string;
  tipo_documento?: string;
  tipo_documento_otro?: string;
  fecha_nacimiento?: string;
  genero?: string;
  rh?: string;
  direccion?: string;
  barrio?: string;
  comuna?: string;
  estrato?: string;
  telefono?: string;
  estado_civil?: string;
  nivel_educativo?: string;
  pertenencia_etnica?: string;
  discapacidad?: boolean;
  discapacidad_tipo?: string;
  victima_conflicto?: boolean;
  ruv?: boolean;
  salud?: string;
  dependientes_total?: number;
  dependientes_menores?: number;
  dependientes_adultos_mayores?: number;
  dependientes_discapacidad?: number;
  experiencia_anios?: number;
  jornada?: string;
  lugar_recoleccion?: string;
  microruta?: string;
  microruta_direccion_inicial?: string;
  microruta_direccion_final?: string;
  transporte?: string[];
  transporte_otro?: string;
  placa_habitual?: string;
  epp?: string;
  materiales?: string[];
  materiales_otros?: string;
  autoriza_datos?: boolean;
}

const MAX_EDAD = 120;

function fechaValida(valor: string | undefined, nombre: string, hoy: Date): Date | null {
  if (!valor) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const fecha = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!fecha || fecha.toISOString().slice(0, 10) !== valor) throw new ValidationError(`${nombre} no es una fecha válida`);
  if (fecha > hoy) throw new ValidationError(`${nombre} no puede ser futura`);
  return fecha;
}

/**
 * Valida las reglas entre campos y devuelve una copia limpia: las respuestas dependientes de una opción
 * no elegida se descartan para no conservar datos contradictorios.
 */
export function validarCaracterizacion(entrada: Caracterizacion, hoy: Date, exigirAutorizacion: boolean): Caracterizacion {
  const c: Caracterizacion = { ...entrada };
  if (c.placa_habitual !== undefined) {
    if (typeof c.placa_habitual !== 'string') throw new ValidationError('La placa habitual debe ser texto');
    const placa = c.placa_habitual.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,15}$/.test(placa)) throw new ValidationError('La placa habitual debe tener de 3 a 15 letras, números o guiones');
    c.placa_habitual = placa;
  }

  if (!c.fecha_inscripcion) throw new ValidationError('La fecha de inscripción es obligatoria');
  fechaValida(c.fecha_inscripcion, 'La fecha de inscripción', hoy);
  if (!c.tipo_documento) throw new ValidationError('El tipo de documento es obligatorio');
  const nacimiento = fechaValida(c.fecha_nacimiento, 'La fecha de nacimiento', hoy);
  if (nacimiento && nacimiento.getUTCFullYear() < hoy.getUTCFullYear() - MAX_EDAD) {
    throw new ValidationError('La fecha de nacimiento no es válida');
  }

  if (c.tipo_documento === 'Otro') {
    if (!c.tipo_documento_otro) throw new ValidationError('Especifica el tipo de documento');
  } else delete c.tipo_documento_otro;

  if (c.pertenece_organizacion) {
    if (!c.organizacion_nombre) throw new ValidationError('Indica el nombre de la organización');
  } else {
    delete c.organizacion_nombre;
    delete c.organizacion_nit;
  }

  if (c.discapacidad) {
    if (!c.discapacidad_tipo) throw new ValidationError('Especifica el tipo de discapacidad');
  } else delete c.discapacidad_tipo;

  if (!c.victima_conflicto) delete c.ruv;

  if (c.transporte?.includes('Otro')) {
    if (!c.transporte_otro) throw new ValidationError('Especifica el otro medio de transporte');
  } else delete c.transporte_otro;

  if (c.materiales?.includes('Otros')) {
    if (!c.materiales_otros) throw new ValidationError('Especifica los otros materiales recuperados');
  } else delete c.materiales_otros;

  if (exigirAutorizacion && c.autoriza_datos !== true) {
    throw new ValidationError('Se requiere la declaración y autorización de tratamiento de datos personales');
  }
  return c;
}
