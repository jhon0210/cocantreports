import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Search, Trash2, UserCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { QueryState } from '@/components/common/QueryState'
import { GradientFrame } from '@/components/common/GradientFrame'
import { TablePagination } from '@/components/common/TablePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/errors'
import { fullName, normalizeSearch } from '@/lib/format'
import { ACCESS, canAccess } from '@/lib/permissions'
import { usuariosService } from '@/services/usuarios.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Usuario } from '@/types/api'

interface UsuariosTableProps {
  usuarios: Usuario[] | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  onChanged: () => void
  onEdit: (usuario: Usuario) => void
  onDelete: (usuario: Usuario) => void
  editingId?: number
}

export function UsuariosTable({ usuarios, loading, error, onRetry, onChanged, onEdit, onDelete, editingId }: UsuariosTableProps) {
  const me = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
    return (usuarios ?? []).filter((u) => {
      const text = normalizeSearch([fullName(u.nomUser, u.apeUser), u.usuario, u.cedula, u.perfil, u.eca, u.cargo, u.activo ? 'Activo' : 'Inactivo'].join(' '))
      return terms.every((term) => text.includes(term))
    })
  }, [usuarios, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * 10
  const rows = filtered.slice(start, start + 10)

  const toggle = async (u: Usuario) => {
    setBusy(u.id_user)
    try {
      await usuariosService.setActivo(u.id_user, !u.activo)
      toast.success(`Usuario "${u.usuario}" ${u.activo ? 'desactivado' : 'activado'}.`)
      onChanged()
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo actualizar el usuario'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <div className="mb-4"><p className="min-h-5 text-sm" aria-hidden="true" /></div>
        <QueryState loading={loading} error={error} isEmpty={usuarios?.length === 0} onRetry={onRetry} emptyTitle="No hay usuarios">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                placeholder="Buscar por cualquier campo…"
                aria-label="Buscar usuarios"
                autoComplete="off"
                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 text-muted-foreground" onClick={() => { setQuery(''); setPage(1) }} aria-label="Limpiar búsqueda"><X /></Button>}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {filtered.length ? `Mostrando ${start + 1}–${Math.min(start + 10, filtered.length)} de ${filtered.length}` : 'Sin resultados'}
            </p>
          </div>
          {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">No se encontraron usuarios.</p> : <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id_user} data-state={editingId === u.id_user ? 'selected' : undefined}>
                  <TableCell className="font-medium">{fullName(u.nomUser, u.apeUser)}</TableCell>
                  <TableCell>{u.usuario}</TableCell>
                  <TableCell>{u.cedula ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.perfil ?? '—'}</Badge>
                    {u.eca && <span className="mt-1 block text-xs text-muted-foreground">{u.eca}</span>}
                  </TableCell>
                  <TableCell>{u.cargo ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={u.activo ? 'default' : 'outline'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {(me?.perfil === 'Administrador' || u.perfil !== 'Administrador') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy === u.id_user} aria-label={`Más acciones para ${u.usuario}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(u)}><Pencil /> Editar</DropdownMenuItem>
                          {u.id_user !== me?.id_user && (!u.activo || canAccess(me?.perfil, ACCESS.eliminar)) && (
                            <>
                              <DropdownMenuSeparator />
                              {u.activo
                                ? <DropdownMenuItem variant="destructive" onSelect={() => onDelete(u)}><Trash2 /> Eliminar (desactivar)</DropdownMenuItem>
                                : <DropdownMenuItem onSelect={() => void toggle(u)}><UserCheck /> Activar</DropdownMenuItem>}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
          <TablePagination current={current} totalPages={totalPages} onPageChange={setPage} />
        </QueryState>
    </GradientFrame>
  )
}
