import type { Reporte } from '@/types/api'

export const BALANCE_HEADERS = [
  'NUECA', 'NUMACRO', 'Número de semana',
  'Tipo de identificación del reciclador u operario',
  'Número de identificación del reciclador u operario',
  'Placa del vehículo que ingresa el material',
  'Cantidad de material entrante',
  'Tipo de material entrante',
  'Rechazo asociado al material entrante',
  'Tipo de sitio de destino',
  'Número único del sitio de destino',
] as const

export const BALANCE_INSTRUCCIONES = [
  '',
  '',
  'Número de la semana del mes en la cual se ingresó el material aprovechado a la ECA. El dato ingresado corresponde a los números enteros entre 1 y 5.',
  'Reporte el tipo de identificación del miembro de la organización que está entregando el material en la ECA, de acuerdo con la siguiente codificación: 1=CC, 2=CE, 3=pasaporte, 4=NIT.',
  'Número de identificación del miembro de la organización que entregó el material en la ECA y cuyo tipo de identificación fue señalado en el campo anterior. Nota: no incluya puntos ni guiones; en caso de reportar un NIT no incluya el dígito de verificación.',
  'Placa del vehículo (sin espacios ni guiones) en el cual se transportaron los residuos sólidos hasta la ECA. Nota: en caso de ser un vehículo sin placas, indique la asignación de placas reportada en el formato registro de vehículos.',
  'Indique los kilogramos entregados a la ECA.',
  'Código correspondiente al tipo de material aprovechado, de acuerdo con el listado de códigos vigente para el período de reporte, publicado en la página web del SUI.',
  'Indique los kilogramos de rechazo provenientes de la clasificación y aprovechamiento del residuo o material entrante. Nota: este valor no puede ser mayor a la cantidad de kilogramos reportados en el campo 7.',
  'Indique el tipo de sitio de destino de los residuos de rechazo del aprovechamiento, de acuerdo con la siguiente codificación: 1=Relleno sanitario, 2=Estación de transferencia.',
  'Indique el número único de identificación asignado por el SUI al sitio de destino de los residuos de rechazo, de acuerdo con el valor reportado en el campo anterior (Relleno sanitario o Estación de transferencia).',
] as const

const CATALOGO: Record<number, string> = {
  101: 'ALUMINIO', 102: 'CHATARRA', 103: 'COBRE', 104: 'BRONCE', 105: 'ANTIMONIO',
  106: 'ACERO', 199: 'OTROS METALES', 201: 'ARCHIVO', 202: 'CARTON',
  203: 'CUBETAS O PANELES', 204: 'PERIODICO', 205: 'PLEGADIZA', 206: 'TETRA PACK',
  207: 'PLASTIFICADO', 208: 'KRAP', 299: 'OTROS PAPELES', 301: 'ACRILICO',
  302: 'PASTA', 303: 'PET', 304: 'PVC', 305: 'PLASTICO BLANCO', 306: 'POLIETILENO',
  307: 'SOPLADO', 308: 'POLIPROPILENO', 399: 'OTROS PLASTICOS', 499: 'OTROS VIDRIOS',
  599: 'OTROS TEXTILES', 699: 'OTROS MADERABLES',
}
const TIPOS_ID: Record<string, number> = { CC: 1, CE: 2, Pasaporte: 3, NIT: 4 }
const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase()

export const BALANCE_SUGERENCIAS = [
  'Placa: se muestra la placa habitual actual de Caracterizar Recuperador, sin espacios ni guiones. No confirma el vehículo histórico del ingreso; verificarlo con sus soportes y el catálogo de vehículos reportado al SUI.',
  'Rechazo: se registra en Crear Reporte con «Registrar Rechazo» y se suma por recuperador, placa, material y semana. El archivo lo expresa en kilogramos; las filas sin ningún rechazo registrado reportan 0.',
  'Destino: por defecto se usa tipo 1 (relleno sanitario) y el número único 1724818150; cambiarlos en el Excel si algún rechazo tuvo otro destino.',
  'Fecha: confirmar si la fecha de venta coincide con el ingreso físico. Si no coincide, registrar una fecha de ingreso independiente.',
  'Catálogos: resolver las diferencias de código/nombre antes de usar el archivo en el SUI; no se han reemplazado materiales existentes.',
  'Identificación: la imagen indica CC=1, CE=2, pasaporte=3 y NIT=4, sin puntos ni guiones y sin dígito de verificación para NIT. No eliminar el último dígito sin conocer si corresponde al de verificación. TI y PPT siguen sin equivalencia confirmada.',
]

export interface BalanceFila {
  reporte: number
  fecha: string
  celdas: (number | string | null)[]
  novedades: string[]
}

interface GrupoBalance {
  base: Reporte
  consecutivos: number[]
  fecha: string
  semana: number
  entranteG: number
  rechazoG: number
}

const aGramos = (kg: number) => Math.round(kg * 1000)
/** Gramos enteros a kilogramos con exactamente 3 decimales, sin arrastre de coma flotante. */
const aKg = (gramos: number) => Number((gramos / 1000).toFixed(3))
const TIPO_SITIO_DESTINO = 1
const NUMERO_SITIO_DESTINO = 1724818150
/** Enteros sin decimales; solo muestra decimales cuando el peso no es un kilogramo exacto. */
export const formatoKg = (value: number) => (Number.isInteger(value) ? '0' : '0.###')

/**
 * Una fila por ECA, macroruta, mes, semana, recuperador, placa y material. Las cantidades se suman en gramos enteros
 * (sin errores de coma flotante) y se expresan en kilogramos; los rechazos se suman en la misma fila y, sin rechazos, valen 0.
 */
export function construirBalance(reportes: Reporte[]): BalanceFila[] {
  const grupos = new Map<string, GrupoBalance>()
  for (const r of reportes) {
    const semana = Math.ceil(Number(r.FechaVenta.slice(8, 10)) / 7)
    const placa = r.recuperador?.placa_habitual?.replace(/[\s-]/g, '').toUpperCase() ?? ''
    // El mes forma parte de la clave: la semana es "del mes" y un rango puede abarcar varios meses.
    const clave = [r.eca.codigo_nuec, r.macroruta?.codigo, r.FechaVenta.slice(0, 7), semana, r.recuperador?.tipo_documento, r.recuperador?.cedula ?? `sin-${r.id_recuperador}`, placa, r.id_mat].join('|')
    const grupo = grupos.get(clave) ?? { base: r, consecutivos: [], fecha: r.FechaVenta, semana, entranteG: 0, rechazoG: 0 }
    grupo.consecutivos.push(r.consecutivo)
    if (r.FechaVenta < grupo.fecha) grupo.fecha = r.FechaVenta
    grupo.entranteG += aGramos(r.cantidad)
    grupo.rechazoG += aGramos(r.rechazo_kg ?? 0)
    grupos.set(clave, grupo)
  }
  return [...grupos.values()].map(({ base: r, consecutivos, fecha, semana, entranteG, rechazoG }) => {
    const novedades: string[] = []
    const nueca = r.eca.codigo_nuec
    const macro = r.macroruta?.codigo
    const tipo = TIPOS_ID[r.recuperador?.tipo_documento ?? '']
    const placa = r.recuperador?.placa_habitual?.replace(/[\s-]/g, '').toUpperCase() || null
    const material = r.material.codigo
    const materialValido = material != null && CATALOGO[material] !== undefined && normalizar(r.material.nomMaterial ?? '') === CATALOGO[material]
    // Materiales con código interno distinto al del catálogo SUI (p. ej. Chatarra 104 interno = 102 SUI) se homologan por nombre exacto.
    const codigoPorNombre = Object.entries(CATALOGO).find(([, nombre]) => nombre === normalizar(r.material.nomMaterial ?? ''))?.[0]
    const codigoSui = materialValido ? material : codigoPorNombre ? Number(codigoPorNombre) : null
    if (!nueca || !/^\d+$/.test(nueca)) novedades.push('NUECA ausente o no numérico')
    if (!macro || !/^\d+$/.test(macro)) novedades.push('Macroruta no seleccionada o código no numérico')
    if (!tipo) novedades.push('Tipo de identificación ausente o sin equivalencia en el formato')
    if (!r.recuperador?.cedula) novedades.push('Número de identificación no disponible')
    if (r.recuperador?.tipo_documento === 'NIT') novedades.push('Verificar que el NIT no incluya el dígito de verificación; no se elimina automáticamente')
    if (!materialValido) {
      novedades.push(codigoSui === null
        ? `Código/nombre de material no coincide con el catálogo adjunto: ${material ?? 'sin código'} / ${r.material.nomMaterial ?? 'sin nombre'}`
        : `Material ${material ?? 'sin código'} / ${r.material.nomMaterial}: se usó el código ${codigoSui} del catálogo adjunto por coincidencia exacta de nombre`)
    }
    novedades.push(placa
      ? 'Placa tomada de la caracterización habitual actual del recuperador; no confirma el vehículo histórico de este ingreso'
      : 'Placa del vehículo no registrada')
    if (rechazoG > entranteG) novedades.push('El rechazo supera la cantidad de material entrante de la fila')
    if (consecutivos.length > 1) novedades.push(`Fila que suma ${consecutivos.length} registros de la misma semana, recuperador, placa y material: N.° ${[...consecutivos].sort((a, b) => a - b).join(', ')}`)
    return {
      reporte: Math.min(...consecutivos),
      fecha,
      celdas: [
        nueca && /^\d+$/.test(nueca) ? nueca : null,
        macro && /^\d+$/.test(macro) ? macro : null,
        semana,
        tipo ?? null,
        r.recuperador?.cedula ?? null,
        placa,
        aKg(entranteG),
        codigoSui,
        aKg(rechazoG),
        TIPO_SITIO_DESTINO, NUMERO_SITIO_DESTINO,
      ],
      novedades,
    }
  })
}

export async function exportBalanceMasas(filas: BalanceFila[], periodo: string): Promise<void> {
  if (!filas.length) throw new Error('No hay registros para exportar')
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const text = (value: string) => ({ value, type: String })
  const header = (values: readonly string[]) => values.map((value) => ({
    ...text(value), fontWeight: 'bold' as const, textColor: '#FFFFFF', backgroundColor: '#047857', wrap: true,
  }))
  const estiloFormato = {
    fontFamily: 'Arial', fontSize: 10, textColor: '#000000', backgroundColor: '#FFFFFF',
    borderColor: '#000000', borderStyle: 'thin' as const, wrap: true,
    align: 'center' as const, alignVertical: 'center' as const,
  }
  const titulos = BALANCE_HEADERS.map((value) => ({
    ...estiloFormato, ...text(value), fontWeight: 'bold' as const, height: 78,
  }))
  const rows = filas.map((fila) => fila.celdas.map((value, i) => value === null
    ? { ...estiloFormato }
    : typeof value === 'number'
      ? { ...estiloFormato, value, type: Number, format: i === 6 || i === 8 ? formatoKg(value) : '0' }
      : { ...estiloFormato, ...text(value) }))
  const novedades = filas.flatMap((fila) => fila.novedades.map((novedad) => [
    { value: fila.reporte, type: Number }, text(fila.fecha), text(novedad),
  ]))
  await writeXlsxFile([
    {
      sheet: 'Balance de Masas',
      data: [titulos, ...rows],
      columns: [16, 16, 17, 19, 23, 23, 16, 19, 22, 21, 26].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      sheet: 'Novedades',
      data: [
        [text('Periodo'), text(periodo)],
        [text('Los datos no disponibles se dejan vacíos y no se reemplazan con cero; el rechazo sin registros se reporta en 0.')],
        [text('Cantidad: kilogramos (peso real; enteros cuando el peso es exacto). Semana del mes: 1–7, 8–14, 15–21, 22–28 y 29–31. Fecha usada: venta.')],
        header(['Registro de venta', 'Fecha de venta', 'Novedad']),
        ...novedades,
        [],
        [text('Sugerencias de implementación')],
        ...BALANCE_SUGERENCIAS.map((s) => [text(s)]),
        [],
        [text('Formato visual y codificaciones de identificación/destino tomados de la imagen suministrada. La imagen no acredita por sí sola la versión vigente del anexo oficial SUI.')],
      ],
      columns: [{ width: 28 }, { width: 22 }, { width: 100 }],
    },
  ]).toFile(`balance-masas-${periodo}.xlsx`)
}
