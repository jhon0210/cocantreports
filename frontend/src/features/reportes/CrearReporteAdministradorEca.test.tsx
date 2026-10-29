import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrearReportePage } from '@/pages/CrearReportePage'

const mocks = vi.hoisted(() => ({ enabled: [] as boolean[], eca: null as number | null }))

vi.mock('@/hooks/useQuery', () => ({
  useQuery: (_fetcher: unknown, enabled = true) => {
    mocks.enabled.push(enabled)
    return { data: [], loading: false, error: null, reload: vi.fn() }
  },
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (state: { user: { perfil: string; id_eca: number | null } }) => unknown) =>
    selector({ user: { perfil: 'Administrador Eca', id_eca: mocks.eca } }),
}))
vi.mock('@/services/reportes.service', () => ({ reportesService: { listAll: vi.fn(), createBatch: vi.fn() } }))
vi.mock('@/components/common/PdfPreviewDialog', () => ({ PdfPreviewDialog: () => null }))
vi.mock('@/features/reportes/CarnetRecuperador', () => ({ CarnetRecuperador: () => null }))
vi.mock('@/features/reportes/BuscarRecuperadorCard', () => ({
  BuscarRecuperadorCard: ({ onFound }: { onFound: (value: unknown) => void }) => (
    <button onClick={() => onFound({ id_recuperador: 1, nombre: 'Ana', apellido: 'Prueba', cedula: '123456', estado: 'Activo' })}>Buscar prueba</button>
  ),
}))
vi.mock('@/features/reportes/ReporteForm', () => ({
  ReporteForm: ({ ecaId }: { ecaId?: string }) => <p>ECA fija {ecaId}</p>,
}))

describe('Crear Reporte para el Administrador Eca', () => {
  beforeEach(() => {
    mocks.enabled.length = 0
    mocks.eca = 3
  })

  it('no muestra «Editar Información», no consulta reportes guardados y fija la ECA', async () => {
    render(<CrearReportePage />)
    expect(screen.getByRole('tab', { name: /Crear Reporte/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Editar Información/ })).not.toBeInTheDocument()
    expect(mocks.enabled).toContain(false)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Buscar prueba' }))
    expect(await screen.findByText('ECA fija 3')).toBeInTheDocument()
  })

  it('sin ECA asociada informa y no permite registrar ventas', () => {
    mocks.eca = null
    render(<CrearReportePage />)
    expect(screen.getByText('Sin ECA asociada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar prueba' })).not.toBeInTheDocument()
  })
})
