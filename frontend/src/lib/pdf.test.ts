import { buildComprobantePdf } from './pdf'
import type { Reporte } from '@/types/api'

const reporte: Reporte = {
  consecutivo: 1,
  comprobante: '2438a8f1-b3c9-4fc0-8cc2-d48c9a2f0540',
  numero_reporte: 1,
  id_mat: 2,
  material: { codigo: 101, nomMaterial: 'Carton' },
  cantidad: 2.5,
  valor: 1000,
  subtotal: 2500,
  id_user: 1,
  usuario: { nomUser: 'Ana', apeUser: 'Prueba', usuario: 'ana' },
  id_eca: 3,
  eca: { nomEca: 'ECA Prueba', direccion: 'Calle 1', comuna: null },
  id_recuperador: 1,
  recuperador: { nombre: 'Pedro', apellido: 'Prueba', cedula: '123456' },
  FechaVenta: '2026-10-14',
  FechaRegistro: '2026-10-14',
}

const readBlob = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(reader.error)
  reader.onload = () => resolve(String(reader.result))
  reader.readAsText(blob)
})

describe('Comprobante PDF', () => {
  it('genera un unico PDF con todos los materiales y el total conjunto', async () => {
    const blob = buildComprobantePdf([reporte, { ...reporte, consecutivo: 2, material: { codigo: 102, nomMaterial: 'Plastico' } }])
    expect(blob.type).toBe('application/pdf')
    const content = await readBlob(blob)
    expect(content).toContain('Carton')
    expect(content).toContain('Plastico')
    expect(content).toContain('TOTAL')
    expect(content).toContain('$ 5.000')
    expect(content).toContain('DE REPORTE')
    expect(content).not.toContain('GRACIAS')
    expect(content).not.toContain('REFERENCIA')
    expect(content).not.toContain('Registro N')
    expect(content.match(/\/Type \/Page\b/g)).toHaveLength(1)
  })

  it('agrega paginas para lotes largos sin omitir el ultimo registro', async () => {
    const content = await readBlob(buildComprobantePdf(Array.from({ length: 80 }, (_, i) => ({
      ...reporte, consecutivo: i + 1, material: { codigo: i, nomMaterial: `Material-${i}` },
    }))))
    expect(content.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1)
    expect(content).toContain('Material-79')
    expect(content).toContain('$ 200.000')
  })

  it('rechaza un comprobante vacio', () => {
    expect(() => buildComprobantePdf([])).toThrow('El comprobante no contiene registros')
  })
})
