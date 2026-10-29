import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReporteForm } from './ReporteForm'

vi.mock('@/services/materiales.service', () => ({
  materialesService: { list: () => Promise.resolve([{ id_mat: 1, codigo: 101, nomMaterial: 'Cartón' }]) },
}))
vi.mock('@/services/ecas.service', () => ({
  ecasService: { list: () => Promise.resolve([{ id_eca: 2, nomEca: 'Bodega' }]) },
}))

describe('Registrar venta: cantidad en kg', () => {
  it('envía 0 kg sin confundirlo con un campo vacío', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<ReporteForm initialValues={{ id_mat: '1', id_eca: '2', cantidad: 0, valor: 800, FechaVenta: '' }} onSubmitValues={save} />)
    expect(await screen.findByRole('spinbutton', { name: /Cantidad vendida/ })).toHaveValue(0)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.objectContaining({ cantidad: 0 }),
    })))
  })
})
