import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConsultarReportePage } from '@/pages/ConsultarReportePage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), materials: vi.fn() }))
vi.mock('@/services/reportes.service', () => ({ reportesService: { listAll: mocks.list } }))
vi.mock('@/services/materiales.service', () => ({ materialesService: { list: mocks.materials } }))
vi.mock('@/components/common/PdfPreviewDialog', () => ({ PdfPreviewDialog: () => null }))
vi.mock('@/features/reportes/ReportesTable', () => ({ ReportesTable: () => <p>Resultados de consulta</p> }))

describe('Consulta por material', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([])
    mocks.materials.mockResolvedValue([{ id_mat: 7, codigo: 107, nomMaterial: 'Vidrio' }])
    HTMLElement.prototype.scrollIntoView = vi.fn()
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  it('carga el catálogo solo al elegir material y envía el ID y las fechas a la API', async () => {
    render(<ConsultarReportePage />)
    expect(mocks.materials).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('combobox', { name: /Tipo de consulta/ }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Material y fecha de venta' }))
    await waitFor(() => expect(mocks.materials).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Consultar' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('combobox', { name: /^Material/ }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: /107 · Vidrio/ }))
    fireEvent.change(screen.getByLabelText(/Venta desde/), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText(/Venta hasta/), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith({
      id_mat: 7, ventaDesde: '2026-10-01', ventaHasta: '2026-10-14',
    }))
    expect(await screen.findByText(/Material y fecha de venta · Vidrio/)).toBeInTheDocument()
  })
})
