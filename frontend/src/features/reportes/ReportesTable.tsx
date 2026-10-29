import { useMemo, useState } from 'react'
import { FileText, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { TablePagination } from '@/components/common/TablePagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCOP, formatDate, formatKg, fullName, normalizeSearch } from '@/lib/format'
import type { Reporte } from '@/types/api'

interface ReportesTableProps {
  reportes: Reporte[] | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  onPrint?: (reporte: Reporte) => void
  onEdit?: (reporte: Reporte) => void
  onDelete?: (reporte: Reporte) => void
}

export function ReportesTable({ reportes, loading, error, onRetry, onPrint, onEdit, onDelete }: ReportesTableProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
    return (reportes ?? []).filter((r) => {
      const text = normalizeSearch([
        r.consecutivo, formatDate(r.FechaVenta), r.recuperador?.nombre, r.recuperador?.apellido, r.recuperador?.cedula,
        r.eca.nomEca, r.material.codigo, r.material.nomMaterial, r.cantidad, r.valor, r.subtotal,
      ].join(' '))
      return terms.every((term) => text.includes(term))
    })
  }, [reportes, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * 10
  const rows = filtered.slice(start, start + 10)

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <div className="mb-4"><p className="min-h-5 text-sm" aria-hidden="true" /></div>
        <QueryState
          loading={loading}
          error={error}
          isEmpty={reportes?.length === 0}
          onRetry={onRetry}
          emptyTitle="Aún no hay reportes"
          emptyDescription="Cuando guardes una venta aparecerá aquí."
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Buscar por cualquier campo…" aria-label="Buscar reportes" className="pl-8" />
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {filtered.length ? `Mostrando ${start + 1}–${start + rows.length} de ${filtered.length}` : 'Sin resultados'}
            </p>
          </div>
          {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">No se encontraron reportes.</p> : <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha venta</TableHead>
                <TableHead>Recuperador</TableHead>
                <TableHead>ECA</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Valor unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.consecutivo}>
                  <TableCell className="font-medium">{r.consecutivo}</TableCell>
                  <TableCell>{formatDate(r.FechaVenta)}</TableCell>
                  <TableCell>
                    {r.recuperador ? (
                      <>
                        {fullName(r.recuperador.nombre, r.recuperador.apellido)}
                        <span className="block text-xs text-muted-foreground">{r.recuperador.cedula}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{r.eca.nomEca ?? '—'}</TableCell>
                  <TableCell>
                    {r.material.codigo} · {r.material.nomMaterial}
                  </TableCell>
                  <TableCell className="text-right">{formatKg(r.cantidad)}</TableCell>
                  <TableCell className="text-right">{formatCOP(r.valor)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCOP(r.subtotal)}</TableCell>
                  <TableCell className="text-right">
                    {onPrint && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onPrint(r)} aria-label={`Ver PDF del reporte ${r.consecutivo}`}>
                        <FileText /> PDF
                      </Button>
                    )}
                    {(onEdit || onDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Más acciones para reporte ${r.consecutivo}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && <DropdownMenuItem onSelect={() => onEdit(r)}><Pencil /> Editar</DropdownMenuItem>}
                          {onEdit && onDelete && <DropdownMenuSeparator />}
                          {onDelete && <DropdownMenuItem variant="destructive" onSelect={() => onDelete(r)}><Trash2 /> Eliminar</DropdownMenuItem>}
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
