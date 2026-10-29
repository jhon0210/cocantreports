import { ChevronDown, Menu, LogOut, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { fullName } from '@/lib/format'
import { logout } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

interface HeaderProps {
  onOpenMenu: () => void
}

export function Header({ onOpenMenu }: HeaderProps) {
  const user = useAuthStore((s) => s.user)

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      toast.warning('No se pudo notificar al servidor, pero se cerró la sesión en este equipo.')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-5">
      <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Abrir menú de navegación">
        <Menu />
      </Button>
      <h1 className="flex-1 truncate text-sm font-semibold tracking-tight">Aplicación de Reportes</h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="Menú de usuario">
            <UserRound aria-hidden="true" />
            <span className="hidden sm:inline">Mi cuenta</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {user && (
            <>
              <div className="grid gap-1 px-2 py-2">
                <p className="break-words text-sm font-medium">{fullName(user.nomUser, user.apeUser)}</p>
                <p className="break-all text-xs text-muted-foreground">@{user.usuario}</p>
                {user.perfil && <Badge variant="secondary" className="mt-1 w-fit">{user.perfil}</Badge>}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => void handleLogout()}>
            <LogOut aria-hidden="true" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
