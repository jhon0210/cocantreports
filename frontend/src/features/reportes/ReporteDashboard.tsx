import { useMemo } from 'react'
import { GradientFrame } from '@/components/common/GradientFrame'
import { formatCOP, formatDate, formatInteger, formatKg } from '@/lib/format'
import type { Recuperador, Reporte } from '@/types/api'
import { CarnetRecuperador } from './CarnetRecuperador'

interface Point {
  label: string
  value: number
}

function CompactChart({ title, points, kind }: { title: string; points: Point[]; kind: 'line' | 'bar' }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const width = Math.max(480, points.length * (kind === 'bar' ? 85 : 55))
  const left = 65
  const plotWidth = width - left - 25
  const x = (i: number) => left + (i + 0.5) * plotWidth / Math.max(1, points.length)
  const y = (value: number) => 170 - value / max * 140
  return (
    <GradientFrame innerClassName="p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <p className="mb-2 text-xs text-muted-foreground">Kilogramos vendidos · pasa el cursor o enfoca un punto para ver el valor.</p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} 215`} style={{ minWidth: width }} className="h-52 w-full" role="img" aria-label={title}>
          <title>{title}</title>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={left} x2={width - 20} y1={30 + i * 35} y2={30 + i * 35} stroke="currentColor" className="text-border" />
              <text x={left - 8} y={34 + i * 35} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatInteger(max * (4 - i) / 4)}</text>
            </g>
          ))}
          {kind === 'line' && <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" />}
          {points.map((p, i) => (
            <g key={p.label} tabIndex={0} role="img" aria-label={`${p.label}: ${formatKg(p.value)}`}>
              <title>{p.label}: {formatKg(p.value)}</title>
              {kind === 'bar'
                ? <rect x={x(i) - 18} y={y(p.value)} width={36} height={170 - y(p.value)} rx={3} fill="currentColor" className="text-primary/80" />
                : <circle cx={x(i)} cy={y(p.value)} r={4} fill="currentColor" className="text-primary" />}
              <text x={x(i)} y={190} textAnchor="middle" className="fill-muted-foreground text-[10px]">{p.label.length > 15 ? `${p.label.slice(0, 14)}…` : p.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </GradientFrame>
  )
}

export function ReporteDashboard({ reportes, recuperador }: { reportes: Reporte[]; recuperador: Recuperador }) {
  const stats = useMemo(() => {
    const fechas = new Map<string, number>()
    const materiales = new Map<number, Point>()
    let kg = 0
    let total = 0
    for (const r of reportes) {
      kg += r.cantidad
      total += r.subtotal
      fechas.set(r.FechaVenta, (fechas.get(r.FechaVenta) ?? 0) + r.cantidad)
      const material = materiales.get(r.id_mat)
      materiales.set(r.id_mat, { label: r.material.nomMaterial ?? String(r.id_mat), value: (material?.value ?? 0) + r.cantidad })
    }
    return {
      kg, total,
      fechas: [...fechas].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ label: formatDate(date), value })),
      materiales: [...materiales.values()].sort((a, b) => b.value - a.value),
    }
  }, [reportes])
  return (
    <div className="grid gap-4">
      <CarnetRecuperador recuperador={recuperador} />
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ['Registros de venta', formatInteger(reportes.length)],
          ['Cantidad total vendida', formatKg(stats.kg)],
          ['Total vendido', formatCOP(stats.total)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {reportes.length ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <CompactChart title="Evolución por fecha de venta" points={stats.fechas} kind="line" />
          <CompactChart title="Ventas por material" points={stats.materiales} kind="bar" />
        </div>
      ) : <p className="py-6 text-center text-sm text-muted-foreground">El recuperador no tiene ventas visibles para tu perfil en este rango de fechas.</p>}
    </div>
  )
}
