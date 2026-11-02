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

  it('en un rechazo pide solo la cantidad rechazada y no cantidad vendida ni valor', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<ReporteForm ecaId="2" onSubmitValues={save} />)
    await user.click(await screen.findByRole('tab', { name: 'Registrar Rechazo' }))
    await user.click(await screen.findByRole('radio', { name: /Cartón/ }))
    expect(screen.queryByRole('spinbutton', { name: /Cantidad vendida/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Valor unitario/)).not.toBeInTheDocument()
    await user.type(screen.getByRole('spinbutton', { name: /Cantidad rechazada/ }), '3.5')
    await user.click(screen.getByRole('button', { name: 'Agregar Registro' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.objectContaining({ tipo: 'RECHAZO', rechazo_kg: 3.5 }),
    })))
  })

  it('exige cantidad rechazada mayor que 0', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    render(<ReporteForm ecaId="2" onSubmitValues={save} />)
    await user.click(await screen.findByRole('tab', { name: 'Registrar Rechazo' }))
    await user.click(await screen.findByRole('radio', { name: /Cartón/ }))
    await user.click(screen.getByRole('button', { name: 'Agregar Registro' }))
    expect(await screen.findByText('Ingresa la cantidad rechazada')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
})
