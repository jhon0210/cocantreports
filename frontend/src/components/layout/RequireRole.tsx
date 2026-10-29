import { Navigate, Outlet } from 'react-router-dom'
import { canAccess, homeFor } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth.store'
import type { Perfil } from '@/types/api'

interface RequireRoleProps {
  allowed: readonly Perfil[]
}

/** Restringe una ruta a ciertos perfiles; el resto vuelve a su página de inicio. */
export function RequireRole({ allowed }: RequireRoleProps) {
  const perfil = useAuthStore((s) => s.user?.perfil)
  if (!canAccess(perfil, allowed)) return <Navigate to={homeFor(perfil)} replace />
  return <Outlet />
}
