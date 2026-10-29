import { unzipSync, strFromU8 } from 'fflate'
import type { ResumenBalance } from '@/services/balance-masas.service'
import { celdasResumenBalance, exportResumenBalance, RESUMEN_BALANCE_HEADERS } from './balance-mensual'

const fila: ResumenBalance = {
  id_eca: 1, id_mat: 1, eca: 'ECA sintetica', codigo: 202, material: 'Cartón',
  entradas_kg: 100, anterior: null, inventario_anterior_kg: null, inventario_final_kg: 40,
  novedades: ['Saldo inicial declarado'],
  captura: {
    periodo: '2026-10', id_eca: 1, id_mat: 1, inventario_inicial_kg: 50, entradas_cat_kg: 20,
    salidas_kg: 100, rechazos_kg: 10, entradas_al_guardar_kg: 100, soporte_salidas: 'Comprador; F-1',
    receptor_rechazos: 'Prestador; R-1', observaciones: null, id_user: 1, version: 1, actualizado_en: '2026-10-27T00:00:00Z',
  },
}

describe('resumen mensual interno', () => {
  it('convierte todas las masas a toneladas y discrimina CAT sin duplicarlo', () => {
    expect(celdasResumenBalance(fila, '2026-10')).toEqual(['2026-10', 'ECA sintetica', 202, 'Cartón', 0.05, 0.1, 0.02, 0.08, 0.1, 0.01, 0.04])
  })

  it('mantiene vacios inventario, salidas y rechazo no registrados', () => {
    expect(celdasResumenBalance({ ...fila, captura: null, inventario_final_kg: null }, '2026-10').slice(4))
      .toEqual([null, 0.1, null, null, null, null, null])
  })

  it('genera y lee un XLSX real con masas a seis decimales, soportes y advertencias', async () => {
    let archivo: Uint8Array | undefined
    vi.doMock('write-excel-file/browser', async () => {
      const { default: writeNode } = await import('write-excel-file/node')
      return { default: (sheets: Parameters<typeof writeNode>[0]) => ({ toFile: async () => { archivo = await writeNode(sheets).toBuffer() } }) }
    })
    try {
      await exportResumenBalance([fila, { ...fila, id_mat: 2, captura: null, inventario_final_kg: null }], '2026-10')
      if (!archivo) throw new Error('No se genero el XLSX')
      const zip = unzipSync(archivo)
      const xml = (name: string) => new DOMParser().parseFromString(strFromU8(zip[name]), 'application/xml')
      const strings = zip['xl/sharedStrings.xml'] ? Array.from(xml('xl/sharedStrings.xml').getElementsByTagName('si')).map((n) => n.textContent) : []
      const sheet = xml('xl/worksheets/sheet1.xml')
      const cell = (ref: string) => {
        const c = Array.from(sheet.getElementsByTagName('c')).find((n) => n.getAttribute('r') === ref)
        const v = c?.getElementsByTagName('v')[0]?.textContent
        return c?.getAttribute('t') === 's' ? strings[Number(v)] : c?.getAttribute('t') === 'inlineStr' ? c.textContent : v ?? null
      }
      expect(RESUMEN_BALANCE_HEADERS.map((_, i) => cell(`${String.fromCharCode(65 + i)}1`))).toEqual([...RESUMEN_BALANCE_HEADERS])
      expect(cell('K2')).toBe('0.04')
      expect(cell('F3')).toBe('0.1')
      for (const ref of ['E3', 'G3', 'H3', 'I3', 'J3', 'K3']) expect(cell(ref)).toBeNull()
      expect(strFromU8(zip['xl/styles.xml'])).toContain('0.000000')
      expect(Array.from(xml('xl/workbook.xml').getElementsByTagName('sheet')).map((n) => n.getAttribute('name')))
        .toEqual(['Balance mensual interno', 'Soportes y novedades'])
      const text = `${strings.join(' ')} ${xml('xl/worksheets/sheet2.xml').documentElement.textContent}`
      expect(text).toContain('BORRADOR INTERNO')
      expect(text).toContain('Comprador; F-1')
    } finally { vi.doUnmock('write-excel-file/browser') }
  })
})
