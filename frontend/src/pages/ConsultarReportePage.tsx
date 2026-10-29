import { useState, type FormEvent } from 'react'
import { BarChart3, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/common/Field'
import { GradientFrame } from '@/components/common/GradientFrame'
import { PageHeader } from '@/components/common/PageHeader'
import { PdfPreviewDialog } from '@/components/common/PdfPreviewDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReporteDashboard } from '@/features/reportes/ReporteDashboard'
import { ReportesTable } from '@/features/reportes/ReportesTable'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { formatCOP, formatDate, formatKg, todayISO } from '@/lib/format'
import { makeComprobantePdf } from '@/lib/pdf-lazy'
import { ecasService } from '@/services/ecas.service'
import { materialesService } from '@/services/materiales.service'
import { recuperadoresService } from '@/services/recuperadores.service'
import { reportesService, type ReportesConsulta } from '@/services/reportes.service'
import type { Recuperador, Reporte } from '@/types/api'

const MODES = [
  { id: 'venta', label: 'Fechas de venta' },
  { id: 'registro', label: 'Fechas de registro' },
  { id: 'recuperador', label: 'Recuperador y fecha de venta' },
  { id: 'eca', label: 'ECA y fecha de venta' },
  { id: 'material', label: 'Material y fecha de venta' },
] as const
type Mode = typeof MODES[number]['id']

interface Result {
  rows: Reporte[]
  criterio: string
  filtros: ReportesConsulta
  recuperador?: Recuperador
}

function ConsultaPanel({ estadistico = false }: { estadistico?: boolean }) {
  const [mode, setMode] = useState<Mode | ''>('')
  const [desde, setDesde] = useState(todayISO().slice(0, 7) + '-01')
  const [hasta, setHasta] = useState(todayISO())
  const [cedula, setCedula] = useState('')
  const [eca, setEca] = useState('')
  const [material, setMaterial] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [printing, setPrinting] = useState(false)
  const ecas = useQuery(ecasService.list, !estadistico && mode === 'eca')
  const materiales = useQuery(materialesService.list, !estadistico && mode === 'material')
  const recMode = estadistico || mode === 'recuperador'
  const prefix = estadistico ? 'estadistica' : 'consulta'
  const consultaSeleccionada = estadistico || mode !== ''

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!consultaSeleccionada) {
      setError('Selecciona el tipo de consulta que necesitas.')
      return
    }
    if (desde > hasta) {
      setError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    if (!estadistico && mode === 'material' && (!material || materiales.error)) {
      setError(materiales.error ?? 'Selecciona el material para realizar la consulta.')
      return
    }
    const filtros: ReportesConsulta = !estadistico && mode === 'registro'
      ? { registroDesde: desde, registroHasta: hasta }
      : {
          ventaDesde: desde,
          ventaHasta: hasta,
          ...(recMode ? { cedula: cedula.trim() } : {}),
          ...(!estadistico && mode === 'eca' ? { id_eca: Number(eca) } : {}),
          ...(!estadistico && mode === 'material' ? { id_mat: Number(material) } : {}),
        }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const [rows, recuperador] = await Promise.all([
        reportesService.listAll(filtros),
        estadistico ? recuperadoresService.getByCedula(cedula.trim()) : Promise.resolve(undefined),
      ])
      const label = estadistico ? `Recuperador ${cedula.trim()}` : MODES.find((m) => m.id === mode)?.label ?? ''
      const extra = !estadistico && mode === 'recuperador' ? ` · Cédula ${cedula.trim()}` : !estadistico && mode === 'eca' ? ` · ${ecas.data?.find((e) => String(e.id_eca) === eca)?.nomEca ?? 'ECA'}` : !estadistico && mode === 'material' ? ` · ${materiales.data?.find((m) => String(m.id_mat) === material)?.nomMaterial ?? 'Material'}` : ''
      setResult({ rows, recuperador, filtros, criterio: `${label}${extra} · ${formatDate(desde)} al ${formatDate(hasta)}` })
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo realizar la consulta'))
    } finally {
      setBusy(false)
    }
  }

  const exportExcel = async () => {
    if (!result) return
    setExporting(true)
    try {
      await (await import('@/lib/reportes-excel')).exportReportesExcel(result.rows, result.criterio)
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo exportar a Excel'))
    } finally {
      setExporting(false)
    }
  }

  const print = async (reporte: Reporte) => {
    if (printing) return
    setPrinting(true)
    try {
      setPdf(await makeComprobantePdf(await reportesService.comprobante(reporte.consecutivo)))
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo generar el comprobante'))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="grid gap-4">
      <GradientFrame innerClassName="px-5 py-4">
        {!estadistico && (
          <div className="mb-4 grid gap-3">
            <p className="text-sm text-muted-foreground">Elige la consulta que necesites. Al seleccionar una opción se habilitarán los campos y el botón Consultar.</p>
            <Field id="tipo-consulta" label="Tipo de consulta" required>
              <Select
                value={mode}
                disabled={busy}
                onValueChange={(value) => {
                  const selected = MODES.find((m) => m.id === value)
                  if (selected) {
                    setMode(selected.id)
                    setResult(null)
                    setError(null)
                  }
                }}
              >
                <SelectTrigger id="tipo-consulta" className="w-full sm:max-w-md"><SelectValue placeholder="Selecciona una consulta" /></SelectTrigger>
                <SelectContent>{MODES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        )}
        {estadistico && <p className="mb-4 text-sm text-muted-foreground">Ingresa la cédula del recuperador y el rango de fechas de venta para generar su dashboard con información, totales y gráficos.</p>}
        <form onSubmit={(event) => void search(event)} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id={`${prefix}-desde`} label={mode === 'registro' && !estadistico ? 'Registro desde' : 'Venta desde'} required>
            <Input id={`${prefix}-desde`} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required disabled={busy || !consultaSeleccionada} />
          </Field>
          <Field id={`${prefix}-hasta`} label={mode === 'registro' && !estadistico ? 'Registro hasta' : 'Venta hasta'} required>
            <Input id={`${prefix}-hasta`} type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required disabled={busy || !consultaSeleccionada} />
          </Field>
          {recMode && (
            <Field id={`${prefix}-cedula`} label="Cédula del recuperador" required>
              <Input id={`${prefix}-cedula`} inputMode="numeric" pattern="[0-9]{5,15}" minLength={5} maxLength={15} value={cedula} onChange={(e) => setCedula(e.target.value)} required disabled={busy} />
            </Field>
          )}
          {!estadistico && mode === 'eca' && (
            <Field id={`${prefix}-eca`} label="ECA" required>
              <Select value={eca} onValueChange={setEca} disabled={busy || ecas.loading} required>
                <SelectTrigger id={`${prefix}-eca`}><SelectValue placeholder={ecas.loading ? 'Cargando…' : 'Selecciona una ECA'} /></SelectTrigger>
                <SelectContent>{ecas.data?.map((e) => <SelectItem key={e.id_eca} value={String(e.id_eca)}>{e.nomEca ?? `ECA ${e.id_eca}`}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          {!estadistico && mode === 'material' && (
            <Field id={`${prefix}-material`} label="Material" required>
              <Select value={material} onValueChange={setMaterial} disabled={busy || materiales.loading} required>
                <SelectTrigger id={`${prefix}-material`}><SelectValue placeholder={materiales.loading ? 'Cargando…' : 'Selecciona un material'} /></SelectTrigger>
                <SelectContent>{materiales.data?.map((m) => <SelectItem key={m.id_mat} value={String(m.id_mat)}>{m.codigo} · {m.nomMaterial ?? `Material ${m.id_mat}`}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Button type="submit" disabled={busy || !consultaSeleccionada || (!estadistico && mode === 'eca' && (!eca || !!ecas.error)) || (!estadistico && mode === 'material' && (materiales.loading || !material || !!materiales.error))}><Search /> {busy ? 'Consultando…' : estadistico ? 'Generar dashboard' : 'Consultar'}</Button>
        </form>
        {!estadistico && mode === 'eca' && ecas.error && (
          <div className="mt-3 text-sm text-destructive">{ecas.error} <Button type="button" variant="outline" onClick={() => void ecas.reload()}>Reintentar</Button></div>
        )}
        {!estadistico && mode === 'material' && materiales.error && (
          <div className="mt-3 text-sm text-destructive">{materiales.error} <Button type="button" variant="outline" onClick={() => void materiales.reload()}>Reintentar</Button></div>
        )}
        {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
      </GradientFrame>
      {busy && <p role="status" className="text-sm text-muted-foreground">Consultando reportes…</p>}
      {estadistico && !result && !busy && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-primary/5 px-5 py-10 text-center">
          <BarChart3 className="size-24 text-primary/60" strokeWidth={1.25} aria-hidden="true" />
          <h3 className="text-sm font-semibold">Visualiza la actividad del recuperador</h3>
          <p className="max-w-md text-sm text-muted-foreground">Consulta por cédula y fechas de venta. Aquí aparecerán su foto, información y gráficos con los datos reales de la consulta.</p>
        </div>
      )}
      {result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{result.criterio}</p>
              <p className="mt-1 text-xs text-muted-foreground">{result.rows.length} registros · {formatKg(result.rows.reduce((sum, r) => sum + r.cantidad, 0))} · {formatCOP(result.rows.reduce((sum, r) => sum + r.subtotal, 0))}</p>
            </div>
            <Button type="button" variant="outline" disabled={exporting || !result.rows.length} onClick={() => void exportExcel()}><Download /> {exporting ? 'Exportando…' : 'Exportar a Excel'}</Button>
          </div>
          {estadistico && result.recuperador
            ? <ReporteDashboard reportes={result.rows} recuperador={result.recuperador} />
            : <ReportesTable reportes={result.rows} loading={false} error={null} onRetry={() => undefined} onPrint={(r) => void print(r)} />}
        </>
      )}
      <PdfPreviewDialog open={!!pdf} onOpenChange={(open) => !open && setPdf(null)} title="Comprobante de venta" description="Comprobante de los registros guardados." filename="comprobante.pdf" blob={pdf} />
    </div>
  )
}

export function ConsultarReportePage() {
  return (
    <>
      <PageHeader title="Consultar Reporte" description="Consulta ventas, exporta resultados y analiza la actividad de los recuperadores." />
      <Tabs defaultValue="consultas">
        <TabsList aria-label="Opciones de consulta de reportes">
          <TabsTrigger value="consultas"><Search aria-hidden="true" /> Módulos de Consulta</TabsTrigger>
          <TabsTrigger value="estadisticas"><BarChart3 aria-hidden="true" /> Detalle Estadístico</TabsTrigger>
        </TabsList>
        <TabsContent value="consultas" className="animate-fade-in"><ConsultaPanel /></TabsContent>
        <TabsContent value="estadisticas" className="animate-fade-in"><ConsultaPanel estadistico /></TabsContent>
      </Tabs>
    </>
  )
}
