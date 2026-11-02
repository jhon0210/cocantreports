/** Opciones del formato de inscripción y caracterización. Deben coincidir con backend/src/domain/recuperadores/caracterizacion.ts. */
export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'Pasaporte', 'NIT', 'PPT', 'Otro'] as const
export const TIPOS_DOCUMENTO_AYUDA: Record<string, string> = {
  CC: 'CC · Cédula de Ciudadanía',
  TI: 'TI · Tarjeta de Identidad',
  Pasaporte: 'Pasaporte',
  NIT: 'NIT',
  CE: 'CE · Cédula de Extranjería',
  PPT: 'PPT · Permiso por Protección Temporal',
  Otro: 'Otro',
}
export const GENEROS = ['Femenino', 'Masculino', 'No binario / Otro'] as const
export const GRUPOS_RH = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const
export const ESTRATOS = ['1', '2', '3', 'Sin estrato / Rural'] as const
export const ESTADOS_CIVILES = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Viudo(a)', 'Separado(a)'] as const
export const NIVELES_EDUCATIVOS = [
  'Ninguno',
  'Primaria incompleta',
  'Primaria completa',
  'Secundaria incompleta',
  'Secundaria completa',
  'Técnico / Tecnólogo',
  'Superior',
] as const
export const PERTENENCIAS_ETNICAS = [
  'Indígena',
  'Afrodescendiente / Negro(a) / Mulato(a)',
  'Raizal',
  'Palenquero',
  'Gitano(a)',
  'Ninguna',
] as const
export const AFILIACIONES_SALUD = ['Contributivo', 'Subsidiado (SISBEN)', 'No afiliado'] as const
export const JORNADAS = ['Diurna', 'Nocturna', 'Mixta'] as const
export const LUGARES_RECOLECCION = [
  'Vía pública / Calles',
  'Contenedores o puntos de almacenamiento',
  'Grandes generadores (comercial/industrial)',
  'Estación de Clasificación y Aprovechamiento (ECA)',
] as const
export const TRANSPORTES = ['A pie / Costal o bulto', 'Carretilla manual', 'Motocarro', 'Vehículo automotor', 'Otro'] as const
export const USOS_EPP = ['Siempre', 'A veces', 'Nunca'] as const
/** EPS con afiliados del régimen contributivo en Antioquia. */
export const EPS_ANTIOQUIA = [
  'Nueva EPS',
  'EPS Sura',
  'EPS Sanitas',
  'Salud Total',
  'Coosalud',
  'Famisanar',
  'Savia Salud',
  'Compensar',
  'Aliansalud',
  'Mutual SER',
  'Asmet Salud',
  'Otra',
] as const

/** Comunas y corregimientos del Valle de Aburrá; en los municipios sin comunas se lista el municipio. */
export const COMUNAS_VALLE_ABURRA = [
  ...[
    'Popular', 'Santa Cruz', 'Manrique', 'Aranjuez', 'Castilla', 'Doce de Octubre', 'Robledo', 'Villa Hermosa',
    'Buenos Aires', 'La Candelaria', 'Laureles - Estadio', 'La América', 'San Javier', 'El Poblado', 'Guayabal', 'Belén',
  ].map((nombre, i) => `Medellín - Comuna ${i + 1}: ${nombre}`),
  'Medellín - Corregimiento San Sebastián de Palmitas',
  'Medellín - Corregimiento San Cristóbal',
  'Medellín - Corregimiento Altavista',
  'Medellín - Corregimiento San Antonio de Prado',
  'Medellín - Corregimiento Santa Elena',
  ...Array.from({ length: 12 }, (_, i) => `Bello - Comuna ${i + 1}`),
  ...Array.from({ length: 6 }, (_, i) => `Itagüí - Comuna ${i + 1}`),
  'Envigado',
  'Sabaneta',
  'La Estrella',
  'Caldas',
  'Copacabana',
  'Girardota',
  'Barbosa',
] as const
