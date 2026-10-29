import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceMensualPanel } from './BalanceMensualPanel'
import type { ResumenBalance } from '@/services/balance-masas.service'

const mocks = vi.hoisted(() => ({ guardar: vi.fn() }))
vi.mock('@/services/balance-masas.service', () => ({ balanceMasasService: { guardar: mocks.guardar } }))
vi.mock('@/services/materiales.service', () => ({
  materialesService: { list: async () => [{ id_mat: 7, codigo: 202, nomMaterial: 'Cartón' }] },
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, disabled, onValueChange, children }: { value: string; disabled: boolean; onValueChange: (v: string) => void; children: ReactNode }) =>
    <select aria-label="Material" value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}><option value="">Selecciona</option>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}))

const fila: ResumenBalance = {
  id_eca: 3, id_mat: 7, eca: 'ECA sintetica', codigo: 202, material: 'Cartón',
  entradas_kg: 100, captura: null, anterior: null, inventario_anterior_kg: null,
  inventario_final_kg: null, novedades: ['Falta captura'],
}

describe('capturas dentro de Balance de Masas', () => {
  beforeEach(() => {
    mocks.guardar.mockReset()
    mocks.guardar.mockResolvedValue(undefined)
  })

  it('no permite capturar para todas las ECAs a la vez', () => {
    render(<BalanceMensualPanel periodo="2026-10" filas={[fila]} onSaved={vi.fn()} onBusyChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Guardar captura mensual' })).not.toBeInTheDocument()
    expect(screen.getByText(/Selecciona una ECA específica/)).toBeInTheDocument()
  })

  it('no rellena inventario ni salidas con cero y guarda solo mediciones confirmadas', async () => {
    const user = userEvent.setup()
    const reload = vi.fn().mockResolvedValue(undefined)
    render(<BalanceMensualPanel periodo="2026-10" idEca={3} filas={[fila]} onSaved={reload} onBusyChange={vi.fn()} />)
    await screen.findByRole('option', { name: /Cartón/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Material' }), { target: { value: '7' } })
    expect(screen.getByRole('spinbutton', { name: /Inventario inicial/ })).toHaveValue(null)
    for (const [label, value] of [[/Inventario inicial/, '0'], [/Salidas efectivamente/, '0'], [/Rechazos medidos/, '0']] as const) {
      fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value } })
    }
    await user.click(screen.getByRole('button', { name: 'Guardar captura mensual' }))
    expect(mocks.guardar).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar captura mensual' }))
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({
      periodo: '2026-10', id_eca: 3, id_mat: 7, inventario_inicial_kg: 0, salidas_kg: 0,
      rechazos_kg: 0, entradas_cat_kg: null, entradas_esperadas_kg: 100, version: null,
      mediciones_confirmadas: true,
    })))
    expect(reload).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Captura mensual guardada/)).toBeInTheDocument()
  })

  it('muestra errores de persistencia sin anunciar exito', async () => {
    const user = userEvent.setup()
    mocks.guardar.mockRejectedValue(new Error('La captura cambió durante la edición'))
    render(<BalanceMensualPanel periodo="2026-10" idEca={3} filas={[fila]} onSaved={vi.fn()} onBusyChange={vi.fn()} />)
    await screen.findByRole('option', { name: /Cartón/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Material' }), { target: { value: '7' } })
    for (const label of [/Inventario inicial/, /Salidas efectivamente/, /Rechazos medidos/]) {
      fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value: '0' } })
    }
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar captura mensual' }))
    expect(await screen.findByText(/captura cambió/)).toBeInTheDocument()
    expect(screen.queryByText(/Captura mensual guardada/)).not.toBeInTheDocument()
  })
})
