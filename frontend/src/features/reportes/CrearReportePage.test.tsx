import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrearReportePage } from '@/pages/CrearReportePage'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(),
  pdf: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/hooks/useQuery', () => ({
  useQuery: () => ({ data: [], loading: false, error: null, reload: mocks.reload }),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (state: { user: { perfil: string } }) => unknown) => selector({ user: { perfil: 'Administrador' } }),
}))
vi.mock('@/services/reportes.service', () => ({ reportesService: { listAll: vi.fn(), createBatch: mocks.save } }))
vi.mock('@/lib/pdf-lazy', () => ({ makeComprobantePdf: mocks.pdf }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.toastError } }))
vi.mock('@/features/reportes/CarnetRecuperador', () => ({ CarnetRecuperador: () => null }))
vi.mock('@/components/common/PdfPreviewDialog', () => ({
  PdfPreviewDialog: ({ open }: { open: boolean }) => open ? <p>PDF abierto</p> : null,
}))
vi.mock('@/features/reportes/BuscarRecuperadorCard', () => ({
  BuscarRecuperadorCard: ({ onFound }: { onFound: (value: unknown) => void }) => (
    <button onClick={() => onFound({ id_recuperador: 1, nombre: 'Ana', apellido: 'Prueba', cedula: '123456', estado: 'Activo' })}>Buscar prueba</button>
  ),
}))
vi.mock('@/features/reportes/ReporteForm', () => ({
  ReporteForm: ({ onSubmitValues }: { onSubmitValues: (value: unknown) => void }) => (
    <button onClick={() => onSubmitValues({
      values: { id_mat: '2', id_eca: '3', cantidad: 2.5, valor: 1001, FechaVenta: '2026-10-14' },
      material: { id_mat: 2, codigo: 101, nomMaterial: 'Cartón' },
      eca: { id_eca: 3, nomEca: 'ECA Prueba' },
    })}>Agregar Registro</button>
  ),
}))

describe('CrearReportePage: registros pendientes y confirmación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  })

  it('no persiste al agregar; confirma el lote antes de guardar y abrir un solo PDF', async () => {
    const user = userEvent.setup()
    mocks.save.mockResolvedValue([{ consecutivo: 10, comprobante: 'grupo' }, { consecutivo: 11, comprobante: 'grupo' }])
    render(<CrearReportePage />)
    expect(screen.getByRole('button', { name: 'Guardar Reporte' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Buscar prueba' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Registro' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Registro' }))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(screen.queryByText('PDF abierto')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar Reporte' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirmar datos del reporte' })
    await user.click(within(dialog).getByRole('tab', { name: 'Ver detalle' }))
    expect(within(dialog).getAllByText('Cartón', { exact: false })).toHaveLength(2)
    expect(mocks.save).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar y guardar' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0]).toHaveLength(2)
    expect(mocks.save.mock.calls[0][0][0]).toMatchObject({ id_recuperador: 1, id_mat: 2, id_eca: 3, cantidad: 2.5, valor: 1001 })
    await waitFor(() => expect(screen.getByText('PDF abierto')).toBeInTheDocument())
    expect(mocks.pdf).toHaveBeenCalledTimes(1)
    expect(mocks.pdf.mock.calls[0][0]).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Guardar Reporte' })).toBeDisabled()
  })

  it('conserva los registros y no abre PDF cuando falla el guardado', async () => {
    const user = userEvent.setup()
    mocks.save.mockRejectedValue(new Error('Sin conexión'))
    render(<CrearReportePage />)
    await user.click(screen.getByRole('button', { name: 'Buscar prueba' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Registro' }))
    await user.click(screen.getByRole('button', { name: 'Guardar Reporte' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
    expect(mocks.pdf).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Volver y corregir' }))
    expect(screen.getByText('Cartón', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar Reporte' })).toBeEnabled()
  })
})
