import { useMemo, useState } from 'react'
import { Download, MoreHorizontal, Pencil, Search, SearchX, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { TablePagination } from '@/components/common/TablePagination'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { normalizeSearch } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { downloadEcaAdjunto } from '@/services/ecas.service'
import type { Eca, EcaAdjunto } from '@/types/api'

const PAGE_SIZE = 10

interface EcasTableProps {
  ecas: Eca[] | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  onEdit?: (eca: Eca) => void
  onDelete?: (eca: Eca) => void
  editingId?: number | null
}

export function EcasTable({ ecas, loading, error, onRetry, onEdit, onDelete, editingId }: EcasTableProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState<number | null>(null)
  const download = async (eca: Eca, adjunto: EcaAdjunto) => {
    setDownloading(adjunto.id)
    try {
      await downloadEcaAdjunto(eca.id_eca, adjunto)
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar el PDF'))
    } finally {
      setDownloading(null)
    }
  }
  const filtered = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
    return (ecas ?? []).filter((eca) => {
      const text = normalizeSearch([eca.nomEca, eca.direccion, eca.representante, eca.codigo_nuec, ...(eca.adjuntos ?? []).map((a) => a.nombre)].join(' '))
      return terms.every((term) => text.includes(term))
    })
  }, [ecas, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <div className="mb-4">
        <p className="min-h-5 text-sm" aria-hidden="true" />
      </div>
        <QueryState
          loading={loading}
          error={error}
          isEmpty={ecas?.length === 0}
          onRetry={onRetry}
          emptyTitle="Aún no hay ECAs"
          emptyDescription="Registra la primera con el formulario."
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar por organización, responsable, código…"
                aria-label="Buscar ECAs"
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
                : `Mostrando ${start + 1}–${start + rows.length} de ${filtered.length}${query ? ` (de ${ecas?.length ?? 0})` : ''}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed py-8 text-center">
              <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No se encontraron ECAs</p>
              <p className="text-xs text-muted-foreground">Prueba con otra organización, dirección o responsable.</p>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organización / Bodega</TableHead>
                <TableHead>Representante / Responsable</TableHead>
                <TableHead>Dirección y Municipio / Ciudad</TableHead>
                <TableHead>NUEC / SUI</TableHead>
                <TableHead><span className="sr-only">Descargar documentos</span></TableHead>
                {(onEdit || onDelete) && <TableHead><span className="sr-only">Acciones</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id_eca} data-state={editingId === e.id_eca ? 'selected' : undefined}>
                  <TableCell className="font-medium">{e.nomEca ?? '—'}</TableCell>
                  <TableCell>{e.representante || '—'}</TableCell>
                  <TableCell>{e.direccion ?? '—'}</TableCell>
                  <TableCell>{e.codigo_nuec || '—'}</TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      {e.adjuntos?.map((adjunto) => (
                        <Button
                          key={adjunto.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto max-w-52 justify-start px-2 py-1"
                          disabled={downloading !== null}
                          onClick={() => void download(e, adjunto)}
                          aria-label={`Descargar ${adjunto.nombre}`}
                          title={adjunto.nombre}
                        >
                          <Download className="shrink-0" />
                          <span className="truncate">{downloading === adjunto.id ? 'Descargando…' : adjunto.nombre}</span>
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Más acciones para ${e.nomEca ?? 'ECA'}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && <DropdownMenuItem onSelect={() => onEdit(e)}><Pencil /> Editar</DropdownMenuItem>}
                          {onEdit && onDelete && <DropdownMenuSeparator />}
                          {onDelete && <DropdownMenuItem variant="destructive" onSelect={() => onDelete(e)}><Trash2 /> Eliminar</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
          <TablePagination current={current} totalPages={totalPages} onPageChange={setPage} />
        </QueryState>
    </GradientFrame>
  )
}
