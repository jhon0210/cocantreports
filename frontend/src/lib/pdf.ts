import { jsPDF } from 'jspdf'
import { formatCOP, formatDate, formatKg, fullName } from '@/lib/format'
import type { Recuperador, Reporte } from '@/types/api'
import { renderCarnet } from './carnet'
import type { PdfLogo } from './logo'

type Color = [number, number, number]

const BRAND: Color = [4, 120, 87]
const SOFT: Color = [226, 240, 234]
const GRID: Color = [190, 215, 203]
const INK: Color = [40, 40, 40]
const MUTED: Color = [100, 110, 125]

const MARGIN = 14
const COLUMNS = [88, 28, 32, 34]
const ROW_HEIGHT = 9.5
const LOGO_BOX = { width: 46, height: 28 }

export interface PrefacturaPdfData {
  numeroPrefactura: number
  fechaEmision: string
  eca: {
    nomEca: string | null
    direccion: string | null
    comuna: string | null
  }
  administradorEca: {
    nombre: string
    cedula: number | null
    cargo: string | null
    perfil: string | null
  }
  ventaDesde: string
  ventaHasta: string
  reportes: Reporte[]
  total: number
}

/** Prefactura detallada por venta; es un documento preliminar y no modifica las ventas. */
export function buildPrefacturaPdf(data: PrefacturaPdfData, logo: PdfLogo | null = null): Blob {
  if (!data.reportes.length) throw new Error('La prefactura no contiene ventas')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const right = width - MARGIN
  const columns = [65, 31, 39, 47]
  const columnX = columns.map((_, i) => MARGIN + columns.slice(0, i).reduce((sum, w) => sum + w, 0))
  const band = (x: number, y: number, w: number, label: string) => {
    doc.setFillColor(...BRAND)
    doc.rect(x, y, w, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(label === 'VALOR UNITARIO POR KG' ? 6.5 : 8)
    doc.text(label, x + w / 2, y + 4.7, { align: 'center' })
  }
  const header = (y: number) => {
    ;['DESCRIPCIÓN', 'CANTIDAD (KG)', 'VALOR UNITARIO POR KG', 'MONTO'].forEach((label, i) => band(columnX[i], y, columns[i], label))
  }
  const logoBox = { width: 46, height: 28 }
  let y = 10

  if (logo) {
    const scale = Math.min(logoBox.width / logo.width, logoBox.height / logo.height)
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, y, logo.width * scale, logo.height * scale)
  }
  doc.setTextColor(...BRAND)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(20)
  doc.text('PREFACTURA', right, 20, { align: 'right' })

  const infoBand = (x: number, top: number, w: number, label: string) => {
    doc.setFillColor(...BRAND)
    doc.rect(x, top, w, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, x + 2, top + 4.2)
  }
  const infoLine = (value: string, x: number, top: number, w: number) => {
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const lines = doc.splitTextToSize(value, w - 4) as string[]
    doc.text(lines.slice(0, 2), x + 2, top + 4)
    return Math.max(5, Math.min(lines.length, 2) * 3.5)
  }

  const boxX = 111
  const boxW = right - boxX
  infoBand(boxX, 30, boxW / 2, 'N.º PREFACTURA')
  infoBand(boxX + boxW / 2, 30, boxW / 2, 'FECHA')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(String(data.numeroPrefactura), boxX + boxW / 4, 41, { align: 'center' })
  doc.text(formatDate(data.fechaEmision), boxX + boxW * 0.75, 41, { align: 'center' })
  infoBand(boxX, 45, boxW, 'PERIODO DE VENTA')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`${formatDate(data.ventaDesde)} al ${formatDate(data.ventaHasta)}`, boxX + boxW / 2, 56, { align: 'center' })

  const leftW = 88
  const gap = 8
  infoBand(MARGIN, 48, leftW, 'ECA')
  let leftY = 57
  for (const item of [
    `Nombre: ${data.eca.nomEca ?? '—'}`,
    `Dirección: ${data.eca.direccion ?? '—'}`,
    `Comuna: ${data.eca.comuna ?? '—'}`,
  ]) leftY += infoLine(item, MARGIN, leftY, leftW) + 1

  const adminX = MARGIN + leftW + gap
  const adminW = right - adminX
  infoBand(adminX, 67, adminW, 'ADMINISTRADOR ECA')
  let adminY = 76
  for (const item of [
    `Nombre: ${data.administradorEca.nombre}`,
    `Cédula: ${data.administradorEca.cedula ?? '—'}`,
    `Cargo: ${data.administradorEca.cargo ?? '—'}`,
    `Perfil: ${data.administradorEca.perfil ?? '—'}`,
  ]) adminY += infoLine(item, adminX, adminY, adminW) + 1

  y = Math.max(leftY, adminY) + 4
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Números de reporte relacionados se indican en la descripción de cada venta.', MARGIN, y - 2)
  header(y)
  y += 7
  const rowHeight = 12
  const continuePage = () => {
    doc.addPage()
    doc.setTextColor(...BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`PREFACTURA N.º ${data.numeroPrefactura}`, MARGIN, 14)
    y = 19
    header(y)
    y += 7
  }

  data.reportes.forEach((reporte) => {
    if (y + rowHeight > height - 20) continuePage()
    doc.setDrawColor(...GRID)
    doc.setLineWidth(0.2)
    doc.rect(MARGIN, y, right - MARGIN, rowHeight)
    doc.line(columnX[1], y, columnX[1], y + rowHeight)
    doc.line(columnX[2], y, columnX[2], y + rowHeight)
    doc.line(columnX[3], y, columnX[3], y + rowHeight)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const material = `${reporte.material.codigo == null ? '' : `${reporte.material.codigo} `}${reporte.material.nomMaterial ?? 'Material'}`
    doc.text(doc.splitTextToSize(material, columns[0] - 4)[0] ?? '', MARGIN + 2, y + 4.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const eca = reporte.eca.nomEca ?? data.eca.nomEca ?? '—'
    doc.text(doc.splitTextToSize(`Reporte ${reporte.numero_reporte} · ECA ${eca} · Venta ${formatDate(reporte.FechaVenta)}`, columns[0] - 4)[0] ?? '', MARGIN + 2, y + 9.5)
    doc.setTextColor(...INK)
    doc.setFontSize(8)
    doc.text(formatKg(reporte.cantidad), columnX[1] + columns[1] - 2, y + 7, { align: 'right' })
    doc.text(formatCOP(reporte.valor), columnX[2] + columns[2] - 2, y + 7, { align: 'right' })
    doc.text(formatCOP(reporte.subtotal), right - 2, y + 7, { align: 'right' })
    y += rowHeight
  })

  if (y + 42 > height - 12) continuePage()
  y += 3
  doc.setFillColor(...SOFT)
  doc.rect(columnX[1], y, right - columnX[1], 10, 'F')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL', columnX[1] + 3, y + 6.5)
  doc.text(formatCOP(data.total), right - 2, y + 6.5, { align: 'right' })
  const signatureY = y + 28
  doc.setDrawColor(...MUTED)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, signatureY, MARGIN + 72, signatureY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK)
  doc.text('Firma Administrador ECA', MARGIN, signatureY + 4.5)
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(data.administradorEca.nombre, MARGIN, signatureY + 8.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('DOCUMENTO PRELIMINAR · No marca ni modifica los reportes de venta.', MARGIN, Math.min(y + 40, height - 5))
  return doc.output('blob')
}

/** Comprobante de venta en formato factura: un solo PDF con todos los materiales del reporte y su total. */
export function buildComprobantePdf(reportes: Reporte[], logo: PdfLogo | null = null): Blob {
  if (!reportes.length) throw new Error('El comprobante no contiene registros')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const right = width - MARGIN
  const columnX = COLUMNS.map((_, i) => MARGIN + COLUMNS.slice(0, i).reduce((sum, w) => sum + w, 0))

  const first = reportes[0]
  const numero = String(first.numero_reporte)
  const recuperador = first.recuperador
  const registrador = first.usuario.nomUser ? fullName(first.usuario.nomUser, first.usuario.apeUser) : (first.usuario.usuario ?? '—')
  const ecas = [...new Set(reportes.map((r) => [r.eca.nomEca, r.eca.direccion].filter(Boolean).join(' · ')).filter(Boolean))]

  const band = (x: number, y: number, w: number, label: string, align: 'left' | 'center' = 'center') => {
    doc.setFillColor(...BRAND)
    doc.rect(x, y, w, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, align === 'center' ? x + w / 2 : x + 2, y + 4.2, { align })
  }
  const centered = (value: string, x: number, y: number, w: number, size = 9) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...INK)
    doc.text(value, x + w / 2, y, { align: 'center' })
  }
  const fit = (value: string, w: number, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return (doc.splitTextToSize(value, w) as string[])[0] ?? ''
  }
  const tableHeader = (y: number) => {
    ;['DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNITARIO', 'MONTO'].forEach((label, i) => band(columnX[i], y, COLUMNS[i], label))
  }

  let y = 10
  if (logo) {
    const scale = Math.min(LOGO_BOX.width / logo.width, LOGO_BOX.height / logo.height)
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, y, logo.width * scale, logo.height * scale)
  }
  doc.setTextColor(...BRAND)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(20)
  doc.text('COMPROBANTE DE VENTA', right, 20, { align: 'right' })

  doc.setFontSize(9)
  ecas.slice(0, 4).forEach((eca, i) => doc.text(fit(i === 0 ? `ECA: ${eca}` : eca, 92, 9), MARGIN, 46 + i * 5))

  band(112, 30, 54, 'N.º DE REPORTE')
  band(166, 30, 30, 'FECHA')
  centered(numero, 112, 36 + 4.5, 54)
  centered(formatDate(first.FechaRegistro), 166, 36 + 4.5, 30)

  band(MARGIN, 58, 86, 'RECUPERADOR', 'left')
  band(112, 58, 84, 'REGISTRADO POR', 'left')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(fit(recuperador ? fullName(recuperador.nombre, recuperador.apellido) : '—', 84, 9, true), MARGIN, 71)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cédula: ${recuperador?.cedula ?? '—'}`, MARGIN, 76)
  doc.text(fit(registrador, 82, 9), 112, 71)

  y = 84
  tableHeader(y)
  y += 6
  const guides = (top: number, h: number) => {
    doc.setDrawColor(...GRID)
    doc.setLineWidth(0.2)
    ;[MARGIN, ...columnX.slice(1), right].forEach((x) => doc.line(x, top, x, top + h))
    doc.line(MARGIN, top + h, right, top + h)
  }
  const continuePage = () => {
    doc.addPage()
    doc.setTextColor(...BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`COMPROBANTE DE VENTA · N.º ${numero}`, MARGIN, 14)
    y = 18
  }

  reportes.forEach((r) => {
    if (y + ROW_HEIGHT > height - 14) {
      continuePage()
      tableHeader(y)
      y += 6
    }
    const material = `${r.material.codigo ?? ''} ${r.material.nomMaterial ?? ''}`.trim() || '—'
    doc.setTextColor(...INK)
    doc.text(fit(material, 84, 8.5, true), columnX[0] + 2, y + 4)
    doc.setTextColor(...MUTED)
    doc.text(fit(`ECA ${r.eca.nomEca ?? '—'} · Venta ${formatDate(r.FechaVenta)}`, 84, 6.5), columnX[0] + 2, y + 7.6)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(formatKg(r.cantidad), columnX[1] + COLUMNS[1] - 2, y + 5.5, { align: 'right' })
    doc.text(formatCOP(r.valor), columnX[2] + COLUMNS[2] - 2, y + 5.5, { align: 'right' })
    doc.text(formatCOP(r.subtotal), right - 2, y + 5.5, { align: 'right' })
    guides(y, ROW_HEIGHT)
    y += ROW_HEIGHT
  })

  if (y + 45 > height - 12) continuePage()
  y += 3
  doc.setFillColor(...SOFT)
  doc.rect(columnX[2] - 12, y, right - columnX[2] + 12, 9, 'F')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('TOTAL', columnX[2] - 8, y + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(formatCOP(reportes.reduce((total, r) => total + r.subtotal, 0)), right - 2, y + 6.2, { align: 'right' })

  y += 30
  doc.setDrawColor(...MUTED)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, MARGIN + 65, y)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Firma del recuperador', MARGIN, y + 4.5)
  return doc.output('blob')
}

/** Carnet vertical con el diseño institucional y los datos reales del recuperador. */
export async function buildCarnetPdf(r: Recuperador): Promise<Blob> {
  const canvas = await renderCarnet(r)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [54, 83.16] })
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 54, 83.16, undefined, 'FAST')
  return doc.output('blob')
}
