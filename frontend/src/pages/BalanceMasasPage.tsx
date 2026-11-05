import { useState, type FormEvent } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { Field } from '@/components/common/Field'
import { GradientFrame } from '@/components/common/GradientFrame'
import { PageHeader } from '@/components/common/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { construirBalance, exportBalanceMasas, type BalanceFila } from '@/lib/balance-masas'
import { todayISO } from '@/lib/format'
import { ecasService } from '@/services/ecas.service'
import { reportesService } from '@/services/reportes.service'

export function BalanceMasasPage() {
  const ecas = useQuery(ecasService.list)
  const hoy = todayISO()
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [eca, setEca] = useState('todas')
  const [resultado, setResultado] = useState<{ periodo: string; filas: BalanceFila[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = async (inicio: string, fin: string, idEca?: number) =>
    construirBalance(await reportesService.balanceMasas({ ventaDesde: inicio, ventaHasta: fin, ...(idEca === undefined ? {} : { id_eca: idEca }) }))
  const consultar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!desde || !hasta) {
      setError('Selecciona la fecha inicial y la final')
      return
    }
    if (desde > hasta) {
      setError('La fecha inicial no puede ser posterior a la final')
      return
    }
    if (hasta > hoy) {
      setError('La fecha final no puede ser futura')
      return
    }
    const periodo = desde === hasta ? desde : `${desde}_a_${hasta}`
    setBusy(true)
    setError(null)
    setResultado(null)
    try {
      const filas = await cargar(desde, hasta, eca === 'todas' ? undefined : Number(eca))
      // Consultar exporta de inmediato el Excel; la pantalla solo confirma el resultado.
      if (filas.length) await exportBalanceMasas(filas, periodo)
      setResultado({ periodo, filas })
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo consultar o exportar el balance de masas'))
    } finally {
      setBusy(false)
    }
  }
  const exportar = async () => {
    if (!resultado) return
    setExporting(true)
    setError(null)
    try {
      await exportBalanceMasas(resultado.filas, resultado.periodo)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo exportar el balance de masas'))
    } finally {
      setExporting(false)
    }
  }
  return (
    <>
      <PageHeader title="Balance de Masas" description="Exporta a Excel el balance de masas de ingresos de material a la ECA en el rango de fechas que elijas." />
      <div className="grid gap-4">
        <GradientFrame innerClassName="px-5 py-4">
          <form onSubmit={(event) => void consultar(event)} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="balance-desde" label="Fecha inicial" required>
              <Input id="balance-desde" type="date" max={hasta || hoy} value={desde} onChange={(e) => { setDesde(e.target.value); setResultado(null) }} required disabled={busy || exporting} />
            </Field>
            <Field id="balance-hasta" label="Fecha final" required>
              <Input id="balance-hasta" type="date" min={desde} max={hoy} value={hasta} onChange={(e) => { setHasta(e.target.value); setResultado(null) }} required disabled={busy || exporting} />
            </Field>
            <Field id="balance-eca" label="ECA">
              <Select value={eca} onValueChange={(v) => { setEca(v); setResultado(null) }} disabled={busy || exporting || ecas.loading || !!ecas.error}>
                <SelectTrigger id="balance-eca"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las ECAs</SelectItem>
                  {ecas.data?.map((e) => <SelectItem key={e.id_eca} value={String(e.id_eca)}>{e.nomEca}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" disabled={busy || exporting || ecas.loading || !!ecas.error}>{busy ? 'Consultando y exportando…' : 'Consultar balance'}</Button>
          </form>
          {ecas.error && <div className="mt-3 text-sm text-destructive">{ecas.error} <Button variant="outline" onClick={() => void ecas.reload()}>Reintentar</Button></div>}
          {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        </GradientFrame>
        <Alert><AlertDescription>
          Este módulo exporta a Excel el balance de masas de las ECAs en el rango de fechas elegido: el material que ingresa por recuperador, material y semana, con sus rechazos, según el art. 2.3.2.5.2.13 del Decreto 1077 de 2015 (modificado por el Decreto 1381 de 2024) y los arts. 12 a 14 de la Resolución MinVivienda 412 de 2026. Es un borrador de apoyo, no un cargue oficial al SUI.
        </AlertDescription></Alert>
        {resultado && (
          resultado.filas.length ? (
            <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center" role="status" aria-live="polite">
              <CheckCircle2 className="size-16 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Balance de masas exportado</h3>
              <p className="text-sm text-muted-foreground">
                Se descargó <span className="font-medium text-foreground">balance-masas-{resultado.periodo}.xlsx</span> con {resultado.filas.length} {resultado.filas.length === 1 ? 'registro' : 'registros'}
                {resultado.filas.some((f) => f.novedades.length) && <> · {resultado.filas.filter((f) => f.novedades.length).length} con novedades, detalladas en la hoja «Novedades» del Excel</>}.
              </p>
              <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportar()}><Download />{exporting ? 'Exportando…' : 'Exportar de nuevo'}</Button>
            </section>
          ) : (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground" role="status">No hay reportes en el periodo seleccionado, por lo que no se exportó ningún archivo.</p>
          )
        )}
      </div>
    </>
  )
}
