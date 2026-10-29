import { useState, type FormEvent } from 'react'
import { Download } from 'lucide-react'
import { Field } from '@/components/common/Field'
import { GradientFrame } from '@/components/common/GradientFrame'
import { PageHeader } from '@/components/common/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { BALANCE_HEADERS, BALANCE_SUGERENCIAS, construirBalance, exportBalanceMasas, type BalanceFila } from '@/lib/balance-masas'
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
    setResultado({ periodo: mes, filas: construirBalance(reportes) })
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
      await cargar(periodo, eca === 'todas' ? undefined : Number(eca))
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo consultar el balance de masas'))
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
      <PageHeader title="Balance de Masas" description="Consulta y exportación del formato de 11 columnas de ingresos de material a la ECA, según la imagen suministrada." />
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
            <Button type="submit" disabled={busy || exporting || ecas.loading || !!ecas.error}>{busy ? 'Consultando…' : 'Consultar balance'}</Button>
          </form>
          {ecas.error && <div className="mt-3 text-sm text-destructive">{ecas.error} <Button variant="outline" onClick={() => void ecas.reload()}>Reintentar</Button></div>}
          {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        </GradientFrame>
        <Alert><AlertDescription>
          Este formato no incluye prefacturas ni un resumen mensual interno. La columna 6 muestra la placa habitual actual de Caracterizar Recuperador, sin espacios ni guiones. No confirma el vehículo histórico de cada ingreso y se advierte en Novedades; queda pendiente si no hay placa habitual.
          El rechazo y el destino por ingreso también siguen pendientes; el archivo es un borrador y no está listo para cargar al SUI.
          Se utiliza la fecha del reporte como recepción, según el flujo declarado. La semana por tramos de siete días y los catálogos aún requieren verificar la especificación oficial.
        </AlertDescription></Alert>
        {resultado && (
          <section className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">{resultado.filas.length} registros · {resultado.filas.filter((f) => f.novedades.length).length} con novedades</p>
              <Button disabled={exporting || !resultado.filas.length} onClick={() => void exportar()}><Download />{exporting ? 'Exportando…' : 'Exportar balance de masas (11 columnas)'}</Button>
            </div>
            {!resultado.filas.length ? <p className="text-sm text-muted-foreground">No hay reportes en el periodo seleccionado.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] table-fixed text-xs">
                  <caption className="pb-3 text-left text-muted-foreground">Formato de 11 columnas. En pantallas pequeñas, desplaza la tabla horizontalmente; la columna 6 (placa) permanece visible.</caption>
                  <thead>
                    <tr>{BALANCE_HEADERS.map((h, i) => <th key={h} scope="col" className={`border bg-card p-1 text-center ${i === 5 ? 'sticky right-0 z-10' : ''}`}>{i + 1}</th>)}</tr>
                    <tr>{BALANCE_HEADERS.map((h, i) => <th key={h} scope="col" className={`break-words border bg-card p-2 text-center ${i === 5 ? 'sticky right-0 z-10 font-bold' : ''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>{resultado.filas.slice(0, 50).map((f) => <tr key={f.reporte}>{f.celdas.map((v, i) => <td key={i} className={`break-words border p-2 text-center ${i === 5 ? 'sticky right-0 z-10 bg-card' : ''}`}>{v === null ? 'Pendiente' : (i === 6 || i === 8) && typeof v === 'number' ? v.toFixed(6) : v}</td>)}</tr>)}</tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">Vista previa de hasta 50 registros. El Excel incluye todos los registros consultados.</p>
              </div>
            )}
          </section>
        )}
        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Novedades y sugerencias para completar el proceso</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{BALANCE_SUGERENCIAS.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="mt-3 text-xs text-muted-foreground">Los nombres de macroruta se muestran con el nombre de la ECA del catálogo: la imagen suministra códigos de macroruta, no nombres propios.</p>
        </section>
      </div>
    </>
  )
}
