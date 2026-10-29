import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RequireRole } from '@/components/layout/RequireRole'
import { SidebarNav } from '@/components/layout/SidebarNav'
import { ACCESS } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth.store'
import type { Usuario } from '@/types/api'

const operario: Usuario = {
  id_user: 1, nomUser: 'Olga', apeUser: 'Op', usuario: 'operario1', cedula: 1, id_perfil: 3, perfil: 'Operario', id_cargo: 1, cargo: 'c', id_eca: null, eca: null, activo: true,
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>Presentación institucional</p>} />
          <Route element={<RequireRole allowed={ACCESS.crearReporte} />}>
            <Route path="/reportes/crear" element={<p>Crear reporte</p>} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.consultarReporte} />}>
            <Route path="/reportes/consultar" element={<p>Consultar reporte</p>} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.balanceMasas} />}>
            <Route path="/balance-masas" element={<p>Módulo de balance de masas</p>} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.caracterizar} />}>
            <Route path="/caracterizar/recuperador" element={<p>Módulo de recuperadores</p>} />
            <Route path="/caracterizar/eca" element={<p>Módulo de ECAs</p>} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.usuarios} />}>
            <Route path="/usuarios" element={<p>Módulo de usuarios</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('rutas protegidas', () => {
  it('redirige a /login sin sesión', () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null })
    renderAt('/reportes/crear')
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument()
  })

  it('muestra un estado de carga mientras se restaura la sesión', () => {
    useAuthStore.setState({ status: 'checking', accessToken: null, user: null })
    renderAt('/reportes/crear')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
  })

  it('permite el acceso con sesión', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: operario })
    renderAt('/reportes/crear')
    expect(screen.getByText('Crear reporte')).toBeInTheDocument()
  })

  it('un Operario no entra al módulo de usuarios y vuelve a su inicio', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: operario })
    renderAt('/usuarios')
    expect(screen.queryByText('Módulo de usuarios')).not.toBeInTheDocument()
    expect(screen.getByText('Presentación institucional')).toBeInTheDocument()
  })

  it('un Coordinador sí entra a usuarios', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: { ...operario, perfil: 'Coordinador' } })
    renderAt('/usuarios')
    expect(screen.getByText('Módulo de usuarios')).toBeInTheDocument()
  })

  it.each(['/reportes/consultar', '/caracterizar/recuperador', '/caracterizar/eca'])('un Operario no puede abrir %s directamente', (path) => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: operario })
    renderAt(path)
    expect(screen.getByText('Presentación institucional')).toBeInTheDocument()
  })

  it.each(['Administrador', 'Coordinador'] as const)('%s puede crear reportes y acceder a todos los módulos', (perfil) => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: { ...operario, perfil } })
    renderAt('/reportes/crear')
    expect(screen.getByText('Crear reporte')).toBeInTheDocument()
    render(<MemoryRouter><SidebarNav /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Gestión Reportes' }))
    expect(screen.getByRole('link', { name: 'Consultar Reporte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prefacturar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caracterizar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
  })

  it('el menú del Operario solo muestra Crear Reporte', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: operario })
    render(<MemoryRouter><SidebarNav /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Gestión Reportes' }))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Crear Reporte' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Prefacturar' })).not.toBeInTheDocument()
  })

  it('Administrador Eca no tiene acceso a Prefacturar', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: { ...operario, perfil: 'Administrador Eca' } })
    render(<MemoryRouter><SidebarNav /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Gestión Reportes' }))
    expect(screen.getByRole('link', { name: 'Crear Reporte' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Prefacturar' })).not.toBeInTheDocument()
  })

  it.each(['Administrador', 'Coordinador'] as const)('%s accede al balance de masas', (perfil) => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: { ...operario, perfil } })
    renderAt('/balance-masas')
    expect(screen.getByText('Módulo de balance de masas')).toBeInTheDocument()
    render(<MemoryRouter><SidebarNav /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Balance de Masas' })).toBeInTheDocument()
  })

  it.each(['Operario', 'Administrador Eca'] as const)('%s no abre el balance ni ve su enlace', (perfil) => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 't', user: { ...operario, perfil } })
    renderAt('/balance-masas')
    expect(screen.getByText('Presentación institucional')).toBeInTheDocument()
    render(<MemoryRouter><SidebarNav /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Balance de Masas' })).not.toBeInTheDocument()
  })
})
