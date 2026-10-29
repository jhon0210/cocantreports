import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsuarioForm } from './UsuarioForm'
import { useAuthStore } from '@/stores/auth.store'
import type { Usuario } from '@/types/api'

const mocks = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@/services/usuarios.service', () => ({
  usuariosService: {
    update: mocks.update,
    roles: () => Promise.resolve([{ id_perfil: 3, perfil: 'Operario' }, { id_perfil: 4, perfil: 'Administrador Eca' }]),
    cargos: () => Promise.resolve([]),
  },
}))
vi.mock('@/services/ecas.service', () => ({
  ecasService: { list: () => Promise.resolve([{ id_eca: 2, nomEca: 'ECA Centro' }]) },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const admin: Usuario = {
  id_user: 1, nomUser: 'Ana', apeUser: 'Admin', usuario: 'admin', cedula: 11111,
  id_perfil: 1, perfil: 'Administrador', id_cargo: null, cargo: null, id_eca: null, eca: null, activo: true,
}
const usuario: Usuario = {
  id_user: 5, nomUser: 'Eca', apeUser: 'Prueba', usuario: 'eca.user', cedula: 12345,
  id_perfil: 4, perfil: 'Administrador Eca', id_cargo: null, cargo: null, id_eca: null, eca: null, activo: true,
}

describe('Usuarios: perfil Administrador Eca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setSession('token', admin)
  })

  it('pide la ECA asociada y no guarda sin seleccionarla', async () => {
    const user = userEvent.setup()
    render(<UsuarioForm usuario={usuario} onSaved={vi.fn()} />)
    expect(await screen.findByText('ECA asociada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Selecciona la ECA asociada')).toBeInTheDocument()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('envía la ECA seleccionada junto al perfil', async () => {
    const user = userEvent.setup()
    mocks.update.mockResolvedValue({ ...usuario, id_eca: 2, eca: 'ECA Centro' })
    render(<UsuarioForm usuario={{ ...usuario, id_eca: 2, eca: 'ECA Centro' }} onSaved={vi.fn()} />)
    expect(await screen.findByText('ECA asociada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(5, expect.objectContaining({ id_perfil: 4, id_eca: 2 })))
  })

  it('un perfil distinto no muestra ni envía ECA', async () => {
    const user = userEvent.setup()
    mocks.update.mockResolvedValue(usuario)
    render(<UsuarioForm usuario={{ ...usuario, id_perfil: 3, perfil: 'Operario' }} onSaved={vi.fn()} />)
    await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(screen.queryByText('ECA asociada')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.update.mock.calls[0][1].id_eca).toBeUndefined()
  })
})
