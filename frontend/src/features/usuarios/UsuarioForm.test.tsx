import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsuarioForm } from './UsuarioForm'
import { useAuthStore } from '@/stores/auth.store'
import type { Usuario } from '@/types/api'

const mocks = vi.hoisted(() => ({ update: vi.fn(), toastError: vi.fn() }))

vi.mock('@/services/usuarios.service', () => ({
  usuariosService: {
    update: mocks.update,
    roles: () => Promise.resolve([{ id_perfil: 2, perfil: 'Coordinador' }, { id_perfil: 3, perfil: 'Operario' }]),
    cargos: () => Promise.resolve([]),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.toastError } }))

const usuario: Usuario = {
  id_user: 2, nomUser: 'Ana', apeUser: 'Prueba', usuario: 'anterior', cedula: 12345,
  id_perfil: 2, perfil: 'Coordinador', id_cargo: null, cargo: null, id_eca: null, eca: null, activo: true,
}

describe('Editar nombre de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setSession('token', usuario)
  })

  it('permite editar, envía el nuevo usuario y actualiza la sesión propia', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mocks.update.mockResolvedValue({ ...usuario, usuario: 'nuevo.usuario' })
    render(<UsuarioForm usuario={usuario} onSaved={onSaved} />)
    const input = await screen.findByRole('textbox', { name: /^Usuario/ })
    expect(input).not.toHaveAttribute('readonly')
    await user.clear(input)
    await user.type(input, 'nuevo.usuario')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...usuario, usuario: 'nuevo.usuario' }))
    expect(mocks.update).toHaveBeenCalledWith(usuario.id_user, expect.objectContaining({ usuario: 'nuevo.usuario' }))
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('clave')
    expect(useAuthStore.getState().user?.usuario).toBe('nuevo.usuario')
    expect(useAuthStore.getState().accessToken).toBe('token')
  })

  it('editar otra cuenta no reemplaza la sesión actual', async () => {
    const user = userEvent.setup()
    const target = { ...usuario, id_user: 3, perfil: 'Operario' as const, id_perfil: 3 }
    mocks.update.mockResolvedValue({ ...target, usuario: 'operario.nuevo' })
    const onSaved = vi.fn()
    render(<UsuarioForm usuario={target} onSaved={onSaved} />)
    const input = await screen.findByRole('textbox', { name: /^Usuario/ })
    await user.clear(input)
    await user.type(input, 'operario.nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(useAuthStore.getState().user).toEqual(usuario)
  })

  it('un nombre inválido no se envía a la API', async () => {
    const user = userEvent.setup()
    render(<UsuarioForm usuario={usuario} onSaved={vi.fn()} />)
    const input = await screen.findByRole('textbox', { name: /^Usuario/ })
    await user.clear(input)
    await user.type(input, 'x')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Usa 3 a 50 caracteres: letras, números, punto, guion o guion bajo')).toBeInTheDocument()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
