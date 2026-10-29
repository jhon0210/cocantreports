import type { ResumenBalance } from '@/services/balance-masas.service'

export const RESUMEN_BALANCE_HEADERS = [
  'Periodo', 'ECA', 'Código material', 'Material', 'Inventario inicial (t)',
  'Entradas según reportes (t)', 'Entradas desde CAT incluidas (t)', 'Entradas directas (t)',
  'Salidas efectivas (t)', 'Rechazos (t)', 'Inventario final calculado (t)',
] as const

export function celdasResumenBalance(fila: ResumenBalance, periodo: string): (string | number | null)[] {
  const c = fila.captura
  const toneladas = (value: number | null | undefined) => value == null ? null : value / 1000
  return [
    periodo, fila.eca ?? `ECA ${fila.id_eca}`, fila.codigo, fila.material ?? `Material ${fila.id_mat}`,
    toneladas(c?.inventario_inicial_kg), toneladas(fila.entradas_kg), toneladas(c?.entradas_cat_kg),
    c?.entradas_cat_kg == null ? null : toneladas((Math.round(fila.entradas_kg * 1000) - Math.round(c.entradas_cat_kg * 1000)) / 1000),
    toneladas(c?.salidas_kg), toneladas(c?.rechazos_kg), toneladas(fila.inventario_final_kg),
  ]
}

export async function exportResumenBalance(filas: ResumenBalance[], periodo: string): Promise<void> {
  if (!filas.length) throw new Error('No hay registros mensuales para exportar')
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const texto = (value: string) => ({ value, type: String })
  const headers = (values: readonly string[]) => values.map((value) => ({
    ...texto(value), fontWeight: 'bold' as const, color: '#FFFFFF', backgroundColor: '#047857', wrap: true,
  }))
  const rows = filas.map((fila) => celdasResumenBalance(fila, periodo).map((value, i) => value === null
    ? null
    : typeof value === 'number' ? { value, type: Number, format: i >= 4 ? '0.000000' : '0' } : texto(value)))
  await writeXlsxFile([
    { sheet: 'Balance mensual interno', data: [headers(RESUMEN_BALANCE_HEADERS), ...rows], columns: RESUMEN_BALANCE_HEADERS.map(() => ({ width: 25 })), stickyRowsCount: 1 },
    {
      sheet: 'Soportes y novedades',
      data: [
        [texto('BORRADOR INTERNO. No es un archivo oficial SUI ni certifica cumplimiento normativo.')],
        [texto('Entradas: compras pesadas registradas en Crear Reporte. La prefactura no se descuenta como salida.')],
        [texto('CAT forma parte de las entradas, no se suma de nuevo. La placa habitual no identifica ingresos históricos.')],
        [texto('Los ceros son cantidades declaradas; los datos no capturados permanecen vacíos. Referencias de factura no sustituyen su validación tributaria.')],
        headers(['ECA', 'Material', 'Compradores y facturas de salidas', 'Receptor y soporte de rechazos', 'Observaciones', 'Actualizado', 'Versión', 'Novedades']),
        ...filas.map((f) => [
          texto(f.eca ?? `ECA ${f.id_eca}`), texto(f.material ?? `Material ${f.id_mat}`),
          f.captura?.soporte_salidas ? texto(f.captura.soporte_salidas) : null,
          f.captura?.receptor_rechazos ? texto(f.captura.receptor_rechazos) : null,
          f.captura?.observaciones ? texto(f.captura.observaciones) : null,
          f.captura ? texto(f.captura.actualizado_en) : null,
          f.captura ? { value: f.captura.version, type: Number } : null,
          texto(f.novedades.length ? f.novedades.join(' · ') : 'Sin diferencias aritméticas detectadas; validación normativa pendiente'),
        ]),
      ],
      columns: [25, 25, 60, 60, 60, 28, 12, 100].map((width) => ({ width })),
    },
  ]).toFile(`balance-mensual-interno-${periodo}.xlsx`)
}
