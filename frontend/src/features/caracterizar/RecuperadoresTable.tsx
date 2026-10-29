import { useMemo, useState } from 'react'
import { MoreHorizontal, Eye, Pencil, Search, SearchX, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { CarnetIcon } from '@/components/common/CarnetIcon'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { TablePagination } from '@/components/common/TablePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/errors'
import { formatDate, fullName, normalizeSearch } from '@/lib/format'
import { makeCarnetPdf } from '@/lib/pdf-lazy'
import { recuperadoresService } from '@/services/recuperadores.service'
import { ESTADO_ACTIVO, type Recuperador } from '@/types/api'
import { RecuperadorDetalle } from './RecuperadorDetalle'

const PAGE_SIZE = 10

interface RecuperadoresTableProps {
  recuperadores: Recuperador[] | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  onCarnet: (blob: Blob, recuperador: Recuperador) => void
  /** Si se omiten, las acciones de edición y eliminación no se muestran (perfil de solo consulta). */
  onEdit?: (recuperador: Recuperador) => void
  onDelete?: (recuperador: Recuperador) => void
  editingId?: number | null
}

const estadoVariant = (estado: string) => (estado === ESTADO_ACTIVO ? 'default' : estado === 'Fallecido' ? 'destructive' : 'outline')

/** Texto de todos los datos del recuperador (incluidas las respuestas del formato), para la búsqueda. */
const searchText = (r: Recuperador) =>
  normalizeSearch(
    [
      fullName(r.nombre, r.apellido), r.cedula, r.codigo_registro, r.estado, r.bancarizado ? 'Bancarizado' : '', formatDate(r.FechaRegistro), r.FechaRegistro,
      ...Object.values(r.caracterizacion ?? {}).flat().filter((v) => typeof v === 'string' || typeof v === 'number'),
    ].join(' '),
  )

const documento = (r: Recuperador) => [r.caracterizacion?.tipo_documento, r.cedula].filter(Boolean).join(' ')
const organizacion = (r: Recuperador) =>
  r.caracterizacion ? (r.caracterizacion.pertenece_organizacion ? (r.caracterizacion.organizacion_nombre ?? 'Sí') : 'No') : '—'

export function RecuperadoresTable({ recuperadores, loading, error, onRetry, onCarnet, onEdit, onDelete, editingId }: RecuperadoresTableProps) {
  const [busy, setBusy] = useState<number | null>(null)
  const [detail, setDetail] = useState<Recuperador | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
    if (!recuperadores || terms.length === 0) return recuperadores ?? []
    return recuperadores.filter((r) => {
      const text = searchText(r)
      return terms.every((t) => text.includes(t))
    })
  }, [recuperadores, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  // El listado no trae la foto (es pesada): se consulta el recuperador completo para armar el carnet.
  const openCarnet = async (r: Recuperador) => {
    setBusy(r.id_recuperador)
    try {
      const full = await recuperadoresService.getById(r.id_recuperador)
      onCarnet(await makeCarnetPdf(full), full)
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo generar el carnet'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <div className="mb-4">
        {/* Se conserva la altura del encabezado para no mover el contenido */}
        <p className="min-h-5 text-sm" aria-hidden="true" />
      </div>

      <QueryState
        loading={loading}
        error={error}
        isEmpty={recuperadores?.length === 0}
        onRetry={onRetry}
        emptyTitle="Aún no hay recuperadores"
        emptyDescription="Registra el primero con el formulario."
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por nombre, documento, lugar, organización…"
              aria-label="Buscar recuperadores"
              autoComplete="off"
              className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => {
                  setQuery('')
                  setPage(1)
                }}
                aria-label="Limpiar búsqueda"
              >
                <X />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {filtered.length === 0
              ? 'Sin resultados'
              : `Mostrando ${start + 1}–${start + rows.length} de ${filtered.length}${query ? ` (de ${recuperadores?.length ?? 0})` : ''}`}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed py-8 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No se encontraron recuperadores</p>
            <p className="text-xs text-muted-foreground">Prueba con otro nombre, documento o dato del formato.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombres y apellidos</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Lugar</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Inscripción</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const nombre = fullName(r.nombre, r.apellido)
                return (
                  <TableRow key={r.id_recuperador} data-state={editingId === r.id_recuperador ? 'selected' : undefined}>
                    <TableCell>{r.codigo_registro ?? '—'}</TableCell>
                    <TableCell className="font-medium">{nombre}</TableCell>
                    <TableCell>{documento(r)}</TableCell>
                    <TableCell>{r.caracterizacion?.telefono ?? '—'}</TableCell>
                    <TableCell>{r.caracterizacion?.lugar ?? '—'}</TableCell>
                    <TableCell>{organizacion(r)}</TableCell>
                    <TableCell>
                      <Badge variant={estadoVariant(r.estado)}>{r.estado}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.caracterizacion?.fecha_inscripcion ?? r.FechaRegistro)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setDetail(r)}
                          title="Ver información"
                          aria-label={`Ver información de ${nombre}`}
                        >
                          <Eye />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg bg-primary/10 text-primary shadow-xs hover:bg-primary hover:text-primary-foreground"
                          disabled={busy === r.id_recuperador}
                          onClick={() => void openCarnet(r)}
                          title="Ver carnet"
                          aria-label={`Ver carnet de ${nombre}`}
                        >
                          <CarnetIcon className="size-6" />
                        </Button>
                        {(onEdit || onDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Más acciones para ${nombre}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEdit && (
                                <DropdownMenuItem onSelect={() => onEdit(r)}>
                                  <Pencil /> Editar
                                </DropdownMenuItem>
                              )}
                              {onEdit && onDelete && <DropdownMenuSeparator />}
                              {onDelete && (
                                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(r)}>
                                  <Trash2 /> Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        <TablePagination current={current} totalPages={totalPages} onPageChange={setPage} />
      </QueryState>
      <RecuperadorDetalle recuperador={detail} onClose={() => setDetail(null)} />
    </GradientFrame>
  )
}
