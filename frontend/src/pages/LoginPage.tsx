import { Navigate } from 'react-router-dom'
import { Recycle } from 'lucide-react'
import { LoginForm } from '@/features/auth/LoginForm'
import { GradientFrame } from '@/components/common/GradientFrame'
import { homeFor } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth.store'

export function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const perfil = useAuthStore((s) => s.user?.perfil)

  if (status === 'authenticated') return <Navigate to={homeFor(perfil)} replace />

  return (
    <div className="grid min-h-screen lg:grid-cols-[2fr_3fr]">
      <div className="hidden flex-col justify-between bg-sidebar p-8 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Recycle className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">Aplicación de Reportes</span>
        </div>
        <img src="/img/logoCocjant.png" alt="Cocjant: Soy mi propio súper héroe, reciclo por la vida" className="mx-auto w-full max-w-sm" />
        <p className="text-xs text-sidebar-muted">Acceso exclusivo para personal autorizado.</p>
      </div>

      <main className="flex items-center justify-center p-6">
        <GradientFrame className="w-full max-w-sm animate-fade-in" innerClassName="px-7 pt-8 pb-7">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/10">
              <Recycle className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold tracking-tight">¡Bienvenido!</h2>
            <p className="mt-1 text-xs text-muted-foreground">Inicia sesión para continuar</p>
          </div>
          <LoginForm />
        </GradientFrame>
      </main>
    </div>
  )
}
