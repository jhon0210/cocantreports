import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EcaForm } from './EcaForm'
import type { Eca } from '@/types/api'

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), download: vi.fn(), error: vi.fn() }))
vi.mock('@/services/ecas.service', () => ({ ecasService: mocks }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))

const eca: Eca = {
  id_eca: 1, nomEca: 'Bodega', direccion: 'Calle 1, Medellín', representante: 'Ana',
  codigo_nuec: '', ruta: 'R1', macroruta: 'M1', comuna: 'C1', estado: 'Activa', categoria: 'A',
  adjuntos: [{ id: 10, nombre: 'Guardado.pdf', tamano: 32 }],
}

describe('Formulario normativo de ECA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.update.mockResolvedValue(eca)
  })

  it('envía solo referencias de PDF existentes y no sobrescribe campos históricos ocultos', async () => {
    const user = userEvent.setup()
    render(<EcaForm eca={eca} onSaved={vi.fn()} />)
    expect(screen.getByLabelText(/Representante Legal/)).toHaveValue('Ana')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, {
      nomEca: 'Bodega', direccion: 'Calle 1, Medellín', representante: 'Ana', codigo_nuec: '', adjuntos: [{ id: 10 }],
    }))
  })

  it('envía PDF nuevos como base64 y permite quitar adjuntos antes de guardar', async () => {
    const user = userEvent.setup()
    render(<EcaForm eca={eca} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Quitar Guardado.pdf' }))
    await user.upload(screen.getByLabelText('Adjuntar archivos PDF'), new File(['%PDF-1.7\n%%EOF'], 'Nuevo.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, expect.objectContaining({
      adjuntos: [{ nombre: 'Nuevo.pdf', contenido: btoa('%PDF-1.7\n%%EOF') }],
    })))
  })

  it('rechaza más de cinco archivos y PDF mayores de 2 MB sin enviarlos', async () => {
    const user = userEvent.setup()
    render(<EcaForm eca={eca} onSaved={vi.fn()} />)
    const input = screen.getByLabelText('Adjuntar archivos PDF')
    await user.upload(input, Array.from({ length: 5 }, (_, i) => new File(['PDF'], `${i}.pdf`, { type: 'application/pdf' })))
    expect(mocks.error).toHaveBeenCalledWith('Puedes adjuntar hasta 5 archivos PDF por ECA.')
    await user.upload(input, new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'Grande.pdf', { type: 'application/pdf' }))
    expect(mocks.error).toHaveBeenLastCalledWith(expect.stringContaining('hasta 2 MB'))
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
