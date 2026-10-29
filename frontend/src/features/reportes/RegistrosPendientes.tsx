import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Save, Trash2 } from 'lucide-react'
import { GradientFrame } from '@/components/common/GradientFrame'
import { TablePagination } from '@/components/common/TablePagination'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCOP, formatDate, formatKg, fullName, todayISO } from '@/lib/format'
import type { Recuperador } from '@/types/api'
import type { RegistroVenta } from './ReporteForm'

export interface RegistroPendiente extends RegistroVenta {
  key: string
  recuperador: Recuperador
}

interface RegistrosPendientesProps {
  registros: RegistroPendiente[]
  onEdit?: (registro: RegistroPendiente) => void
  onRemove?: (key: string) => void
  onSave?: () => void
  view?: 'all' | 'summary' | 'detail'
}

export function RegistrosPendientes({ registros, onEdit, onRemove, onSave, view = 'all' }: RegistrosPendientesProps) {
  const [page, setPage] = useState(1)
  const { total, cantidad, fechas } = useMemo(() => {
    let total = 0
    let cantidad = 0
    const fechas = new Set<string>()
    for (const r of registros) {
      total += Math.round(r.values.cantidad * r.values.valor)
      cantidad += r.values.cantidad
      if (r.values.FechaVenta) fechas.add(r.values.FechaVenta)
    }
    return { total, cantidad, fechas: [...fechas].sort() }
  }, [registros])
  const fechaVenta = fechas.length > 1
    ? `${formatDate(fechas[0])} – ${formatDate(fechas[fechas.length - 1])}`
    : fechas.length ? formatDate(fechas[0]) : '—'
  const totalPages = Math.max(1, Math.ceil(registros.length / 5))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * 5
  const rows = registros.slice(start, start + 5)

  return (
    <GradientFrame innerClassName="px-4 py-4 sm:px-6">
      {view !== 'summary' && (
      <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Reportes registrados <span className="text-muted-foreground">({registros.length})</span></h3>
        {onSave && <Button type="button" disabled={!registros.length} onClick={onSave}><Save /> Guardar Reporte</Button>}
      </div>
      {registros.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recuperador</TableHead>
              <TableHead>Fecha venta</TableHead>
              <TableHead>ECA</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Valor unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {(onEdit || onRemove) && <TableHead><span className="sr-only">Acciones</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>{fullName(r.recuperador.nombre, r.recuperador.apellido)}<span className="block text-xs text-muted-foreground">{r.recuperador.cedula}</span></TableCell>
                <TableCell>{r.values.FechaVenta ? formatDate(r.values.FechaVenta) : '—'}</TableCell>
                <TableCell>{r.eca.nomEca ?? '—'}</TableCell>
                <TableCell>{r.material.codigo} · {r.material.nomMaterial}</TableCell>
                <TableCell className="text-right">{formatKg(r.values.cantidad)}</TableCell>
                <TableCell className="text-right">{formatCOP(r.values.valor)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCOP(Math.round(r.values.cantidad * r.values.valor))}</TableCell>
                {(onEdit || onRemove) && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${r.material.nomMaterial}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEdit && <DropdownMenuItem onSelect={() => onEdit(r)}><Pencil /> Editar</DropdownMenuItem>}
                        {onEdit && onRemove && <DropdownMenuSeparator />}
                        {onRemove && <DropdownMenuItem variant="destructive" onSelect={() => onRemove(r.key)}><Trash2 /> Eliminar</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Agrega registros de venta para revisarlos antes de guardar.</p>
      )}
      {registros.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Mostrando {start + 1}–{start + rows.length} de {registros.length} registros
        </p>
      )}
      <TablePagination current={current} totalPages={totalPages} onPageChange={setPage} />
      </>
      )}
      {view === 'summary' ? (
        <dl className="divide-y divide-dashed" aria-label="Resumen de todos los registros">
          {[
            { label: 'Total de registros', description: 'Ventas incluidas en el comprobante', value: registros.length },
            { label: 'Cantidad de material recuperado', description: 'Suma de todos los materiales', value: formatKg(cantidad) },
            { label: 'Fecha de registro', description: 'Se asigna al guardar el reporte', value: formatDate(todayISO()) },
            { label: 'Fecha de venta', description: fechas.length > 1 ? 'Rango de fechas de las ventas incluidas' : 'Fecha de las ventas incluidas', value: fechaVenta },
            { label: 'Total a pagar', description: 'Valor total del comprobante', value: `${formatCOP(total)} COP` },
          ].map(({ label, description, value }) => (
            <div key={label} className="grid items-center gap-2 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <div>
                <dt className="text-sm font-medium">{label}</dt>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
              <dd className={`text-sm font-semibold tabular-nums ${label === 'Total a pagar' ? 'text-primary' : ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : view === 'all' && (
      <div className="mt-3 flex justify-end border-t border-dashed pt-3">
        <dl className="w-full space-y-3 rounded-xl bg-muted/50 px-4 py-3 text-sm sm:max-w-sm" aria-label="Resumen de todos los registros" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Registros agregados</dt>
            <dd className="font-medium tabular-nums">{registros.length}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Cantidad de material recuperado</dt>
            <dd className="font-medium tabular-nums">{formatKg(cantidad)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <dt className="text-muted-foreground">Total a pagar</dt>
            <dd className="font-semibold whitespace-nowrap text-primary tabular-nums">{formatCOP(total)} COP</dd>
          </div>
        </dl>
      </div>
      )}
    </GradientFrame>
  )
}
