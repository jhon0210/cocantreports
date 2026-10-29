import { BALANCE_HEADERS, construirBalance, exportBalanceMasas } from './balance-masas'
import type { Reporte } from '@/types/api'
import { unzipSync, strFromU8 } from 'fflate'

const reporte: Reporte = {
  consecutivo: 1, comprobante: null, numero_reporte: 1,
  id_mat: 1, material: { codigo: 202, nomMaterial: 'Cartón' },
  cantidad: 1250, valor: 800, subtotal: 1000000, id_user: 1,
  usuario: { nomUser: 'Ana', apeUser: 'Prueba', usuario: 'ana' },
  id_eca: 1, eca: { nomEca: 'GIRASOLES', direccion: null, comuna: null, codigo_nuec: '1153705088' },
  id_eca_macroruta: 1, macroruta: { codigo: '1435905088', nombre: 'GIRASOLES' },
  id_recuperador: 1, recuperador: { nombre: 'Ana', apellido: 'Prueba', cedula: '00123456', tipo_documento: 'CC' },
  FechaRegistro: '2026-10-22', FechaVenta: '2026-10-22',
}

describe('balance de masas', () => {
  it('exporta once columnas, toneladas y códigos sin inventar los datos pendientes', () => {
    const [fila] = construirBalance([reporte])
    expect(BALANCE_HEADERS).toHaveLength(11)
    expect(fila.celdas).toEqual(['1153705088', '1435905088', 4, 1, '00123456', null, 1.25, 202, null, null, null])
    expect(fila.novedades).toHaveLength(3)
  })

  it.each([[1, 1], [7, 1], [8, 2], [14, 2], [15, 3], [21, 3], [22, 4], [28, 4], [29, 5], [31, 5]])('el día %i corresponde a semana %i', (dia, semana) => {
    expect(construirBalance([{ ...reporte, FechaVenta: `2026-10-${String(dia).padStart(2, '0')}` }])[0].celdas[2]).toBe(semana)
  })

  it('no transforma una TI en CC ni exporta códigos con nombres incompatibles', () => {
    const [fila] = construirBalance([{
      ...reporte, material: { codigo: 101, nomMaterial: 'Cartón' },
      recuperador: { ...reporte.recuperador!, tipo_documento: 'TI' },
      macroruta: null, eca: { ...reporte.eca, codigo_nuec: 'no válido' },
    }])
    expect(fila.celdas[0]).toBeNull()
    expect(fila.celdas[1]).toBeNull()
    expect(fila.celdas[3]).toBeNull()
    expect(fila.celdas[7]).toBeNull()
    expect(fila.novedades.some((n) => n.includes('101 / Cartón'))).toBe(true)
  })

  it.each([['CC', 1], ['CE', 2], ['Pasaporte', 3], ['NIT', 4]] as const)('codifica %s como %i', (tipo, codigo) => {
    const [fila] = construirBalance([{ ...reporte, recuperador: { ...reporte.recuperador!, tipo_documento: tipo } }])
    expect(fila.celdas[3]).toBe(codigo)
  })

  it('exporta únicamente encabezados y datos sin numeración ni instrucciones', async () => {
    const toFile = vi.fn().mockResolvedValue(undefined)
    const writer = vi.fn().mockReturnValue({ toFile })
    vi.doMock('write-excel-file/browser', () => ({ default: writer }))
    try {
      await exportBalanceMasas(construirBalance([reporte]), '2026-10')
      const sheets = writer.mock.calls[0][0]
      expect(sheets.map((s: { sheet: string }) => s.sheet)).toEqual(['Balance de Masas', 'Novedades'])
      expect(sheets[0].data[0]).toHaveLength(11)
      expect(sheets[0].data[1]).toHaveLength(11)
      expect(sheets[0].data).toHaveLength(2)
      expect(sheets[0].data[0].map((c: { value: string }) => c.value)).toEqual([...BALANCE_HEADERS])
      expect(sheets[0].data[0][0]).toMatchObject({ borderStyle: 'thin', backgroundColor: '#FFFFFF', textColor: '#000000', wrap: true })
      expect(sheets[0].stickyRowsCount).toBe(1)
      expect(sheets[0].data[1][4]).toMatchObject({ value: '00123456', type: String })
      expect(sheets[0].data[1][6]).toMatchObject({ value: 1.25, type: Number, format: '0.000000' })
      for (const i of [5, 8, 9, 10]) expect(sheets[0].data[1][i]).not.toHaveProperty('value')
      expect(sheets[1].data[4][0].value).toBe(1)
      expect(toFile).toHaveBeenCalledWith('balance-masas-2026-10.xlsx')
    } finally {
      vi.doUnmock('write-excel-file/browser')
    }
  })

  it('advierte sobre el dígito de verificación del NIT sin truncar identificaciones', () => {
    const [fila] = construirBalance([{ ...reporte, recuperador: { ...reporte.recuperador!, tipo_documento: 'NIT' } }])
    expect(fila.celdas[4]).toBe('00123456')
    expect(fila.novedades.join(' ')).toContain('dígito de verificación')
  })

  it('escribe un XLSX real con encabezados y datos desde la segunda fila', async () => {
    let archivo: Uint8Array | undefined
    vi.doMock('write-excel-file/browser', async () => {
      const { default: writeNode } = await import('write-excel-file/node')
      return { default: (sheets: Parameters<typeof writeNode>[0]) => ({ toFile: async () => { archivo = await writeNode(sheets).toBuffer() } }) }
    })
    try {
      await exportBalanceMasas(construirBalance([reporte]), '2026-10')
      if (!archivo) throw new Error('No se generó el archivo Excel')
      const zip = unzipSync(archivo)
      const xml = (name: string) => new DOMParser().parseFromString(strFromU8(zip[name]), 'application/xml')
      const strings = zip['xl/sharedStrings.xml'] ? Array.from(xml('xl/sharedStrings.xml').getElementsByTagName('si')).map((n) => n.textContent) : []
      const sheet = xml('xl/worksheets/sheet1.xml')
      const valor = (ref: string) => {
        const c = Array.from(sheet.getElementsByTagName('c')).find((n) => n.getAttribute('r') === ref)
        const v = c?.getElementsByTagName('v')[0]?.textContent
        return c?.getAttribute('t') === 's' ? strings[Number(v)] : c?.getAttribute('t') === 'inlineStr' ? c.textContent : v ?? null
      }
      expect(sheet.getElementsByTagName('row')).toHaveLength(2)
      expect(valor('K1')).toBe('Número único del sitio de destino')
      expect(valor('E2')).toBe('00123456')
      expect(valor('G2')).toBe('1.25')
      for (const ref of ['F2', 'I2', 'J2', 'K2']) expect(valor(ref)).toBeNull()
      expect(sheet.getElementsByTagName('pane')[0].getAttribute('ySplit')).toBe('1')
      expect(strFromU8(zip['xl/styles.xml'])).toContain('0.000000')
    } finally { vi.doUnmock('write-excel-file/browser') }
  })
})
