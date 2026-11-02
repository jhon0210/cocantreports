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
  const [periodo, setPeriodo] = useState(todayISO().slice(0, 7))
  const [eca, setEca] = useState('todas')
  const [resultado, setResultado] = useState<{ periodo: string; filas: BalanceFila[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = async (mes: string, idEca?: number) => {
    const [year, month] = mes.split('-').map(Number)
    const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const reportes = await reportesService.balanceMasas({ ventaDesde: `${mes}-01`, ventaHasta: `${mes}-${ultimo}`, ...(idEca === undefined ? {} : { id_eca: idEca }) })
    const historicos = await reportesService.balanceMasas({ ventaHasta: `${mes}-${ultimo}`, tipo: 'RECHAZO' })
    const conRechazo = new Set(historicos.flatMap((r) => (r.id_recuperador == null ? [] : [r.id_recuperador])))
    return construirBalance(reportes, conRechazo)
  }
  const consultar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      setError('Selecciona un mes válido')
      return
    }
    setBusy(true)
    setError(null)
    setResultado(null)
    try {
      const filas = await cargar(periodo, eca === 'todas' ? undefined : Number(eca))
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
      <PageHeader title="Balance de Masas" description="Exporta a Excel el balance de masas mensual de ingresos de material a la ECA." />
      <div className="grid gap-4">
        <GradientFrame innerClassName="px-5 py-4">
          <form onSubmit={(event) => void consultar(event)} className="grid items-end gap-3 sm:grid-cols-3">
            <Field id="balance-periodo" label="Mes de recepción según reportes" required>
              <Input id="balance-periodo" type="month" max={todayISO().slice(0, 7)} value={periodo} onChange={(e) => { setPeriodo(e.target.value); setResultado(null) }} required disabled={busy || exporting} />
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
          Este módulo exporta a Excel el balance de masas mensual de las ECAs: el material que ingresa por recuperador, material y semana, con sus rechazos, según el art. 2.3.2.5.2.13 del Decreto 1077 de 2015 (modificado por el Decreto 1381 de 2024) y los arts. 12 a 14 de la Resolución MinVivienda 412 de 2026. Es un borrador de apoyo, no un cargue oficial al SUI.
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
