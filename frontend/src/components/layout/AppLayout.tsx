import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Header } from './Header'
import { SidebarNav } from './SidebarNav'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-52 lg:block">
        <SidebarNav />
      </aside>

      {/* En móvil el sidebar se convierte en un Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-60 gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de navegación</SheetTitle>
            <SheetDescription>Opciones principales de la aplicación</SheetDescription>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-52">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl p-3 outline-none sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
