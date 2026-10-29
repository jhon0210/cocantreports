import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Building2, ChevronDown, FilePlus, FileText, Recycle, Search, User, UserCog, Users, type LucideIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ACCESS, canAccess } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import type { Perfil } from '@/types/api'

interface NavLeaf {
  to: string
  label: string
  icon: LucideIcon
  roles: readonly Perfil[]
}

interface NavGroup {
  label: string
  icon: LucideIcon
  roles: readonly Perfil[]
  children: NavLeaf[]
}

type NavItem = NavLeaf | NavGroup

const NAV: NavItem[] = [
  {
    label: 'Gestión Reportes',
    icon: FileText,
    roles: ACCESS.crearReporte,
    children: [
      { to: '/reportes/crear', label: 'Crear Reporte', icon: FilePlus, roles: ACCESS.crearReporte },
      { to: '/reportes/consultar', label: 'Consultar Reporte', icon: Search, roles: ACCESS.consultarReporte },
      { to: '/reportes/prefacturar', label: 'Prefacturar', icon: FileText, roles: ACCESS.prefacturar },
    ],
  },
  {
    label: 'Caracterizar',
    icon: UserCog,
    roles: ACCESS.caracterizar,
    children: [
      { to: '/caracterizar/recuperador', label: 'Recuperador', icon: User, roles: ACCESS.caracterizar },
      { to: '/caracterizar/eca', label: 'ECA', icon: Building2, roles: ACCESS.caracterizar },
    ],
  },
  { to: '/balance-masas', label: 'Balance de Masas', icon: Recycle, roles: ACCESS.balanceMasas },
  { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ACCESS.usuarios },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.9rem] font-medium outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-white/80',
    isActive
      ? 'bg-sidebar-accent text-white shadow-[inset_3px_0_0_0_oklch(0.8_0.15_160)]'
      : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white',
  )

function Group({ item, onNavigate }: { item: NavGroup; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const perfil = useAuthStore((s) => s.user?.perfil)
  const children = item.children.filter((child) => canAccess(perfil, child.roles))
  const active = children.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = useState(active)
  const expanded = open || active

  return (
    <Collapsible open={expanded} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.9rem] font-medium outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-white/80',
          active ? 'bg-sidebar-accent/70 text-white' : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-white',
        )}
      >
        <item.icon className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1 ml-4 grid gap-1 border-l border-sidebar-border pl-2">
          {children.map((child) => (
            <li key={child.to}>
              <NavLink to={child.to} className={linkClass} onClick={onNavigate}>
                <child.icon className="size-4" aria-hidden="true" />
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const perfil = useAuthStore((s) => s.user?.perfil)
  const items = NAV.filter((item) => canAccess(perfil, item.roles))

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Recycle className="size-4" aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold">Reportes</p>
          <p className="text-[0.68rem] text-sidebar-muted">Material de aprovechamiento</p>
        </div>
      </div>
      <nav aria-label="Menú principal" className="flex-1 overflow-y-auto p-2.5">
        <ul className="grid gap-1">
          {items.map((item) => (
            <li key={'children' in item ? item.label : item.to}>
              {'children' in item ? (
                <Group item={item} onNavigate={onNavigate} />
              ) : (
                <NavLink to={item.to} className={linkClass} onClick={onNavigate}>
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
