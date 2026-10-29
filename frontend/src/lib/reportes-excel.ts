import type { Reporte } from '@/types/api'
import { formatDate, fullName } from './format'

export async function exportReportesExcel(reportes: Reporte[], criterio: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const text = (value: string) => ({ value, type: String })
  const number = (value: number, format = '#,##0') => ({ value, type: Number, format })
  const headers = ['N°', 'Fecha venta', 'Fecha registro', 'Recuperador', 'Cédula', 'ECA', 'Código material', 'Material', 'Cantidad (kg)', 'Valor unitario (COP)', 'Subtotal (COP)', 'Registrado por']
  const rows = reportes.map((r) => [
    number(r.consecutivo), text(formatDate(r.FechaVenta)), text(formatDate(r.FechaRegistro)),
    text(r.recuperador ? fullName(r.recuperador.nombre, r.recuperador.apellido) : ''),
    text(r.recuperador?.cedula ?? ''), text(r.eca.nomEca ?? ''), r.material.codigo === null ? text('') : number(r.material.codigo),
    text(r.material.nomMaterial ?? ''), number(r.cantidad, '#,##0.###'), number(r.valor), number(r.subtotal),
    text(fullName(r.usuario.nomUser, r.usuario.apeUser) || r.usuario.usuario || ''),
  ])
  await writeXlsxFile([
    [text('Consulta'), text(criterio)],
    [text('Total registros'), number(reportes.length), text('Total kg'), number(reportes.reduce((sum, r) => sum + r.cantidad, 0), '#,##0.###'), text('Total COP'), number(reportes.reduce((sum, r) => sum + r.subtotal, 0))],
    [],
    headers.map((value) => ({ ...text(value), fontWeight: 'bold' as const, color: '#FFFFFF', backgroundColor: '#047857' })),
    ...rows,
  ], {
    sheet: 'Reportes',
    columns: [10, 17, 17, 30, 20, 28, 18, 28, 20, 23, 23, 28].map((width) => ({ width })),
    stickyRowsCount: 4,
  }).toFile('reportes-cocjant.xlsx')
}
