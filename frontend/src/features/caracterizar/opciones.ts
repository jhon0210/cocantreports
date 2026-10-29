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
export const MATERIALES_RECUPERADOS = [
  'Papel y Cartón',
  'Plástico (PET, PEAD, PEBD, PVC, etc.)',
  'Vidrio',
  'Metales (Hierro, cobre, aluminio, bronce, acero)',
  'Multicapas / Envases tipo Tetrapak',
  'RAEE (Residuos de Aparatos Eléctricos y Electrónicos)',
  'Otros',
] as const
