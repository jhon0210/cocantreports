import { useState, type FormEvent } from 'react'
import { FileText } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/common/Field'
import { GradientFrame } from '@/components/common/GradientFrame'
import { PageHeader } from '@/components/common/PageHeader'
import { PdfPreviewDialog } from '@/components/common/PdfPreviewDialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { formatCOP, formatKg, todayISO } from '@/lib/format'
import { makePrefacturaPdf } from '@/lib/pdf-lazy'
import { ecasService } from '@/services/ecas.service'
import { reportesService } from '@/services/reportes.service'
import { usuariosService } from '@/services/usuarios.service'
import type { Eca, Reporte, Usuario } from '@/types/api'

interface MaterialPrefactura {
  codigo: number | null
  nombre: string
  cantidad: number
  total: number
}

interface ResultadoPrefactura {
  eca: Eca
  ventaDesde: string
  ventaHasta: string
  cantidadReportes: number
  detalles: MaterialPrefactura[]
  reportes: Reporte[]
  total: number
}

const inicioMes = `${todayISO().slice(0, 7)}-01`

function agruparPorMaterial(reportes: Reporte[]): MaterialPrefactura[] {
  const materiales = new Map<number, MaterialPrefactura>()
  reportes.forEach((reporte) => {
    const item = materiales.get(reporte.id_mat) ?? {
      codigo: reporte.material.codigo,
      nombre: reporte.material.nomMaterial ?? 'Material sin nombre',
      cantidad: 0,
      total: 0,
    }
    item.cantidad += reporte.cantidad
    item.total += reporte.subtotal
    materiales.set(reporte.id_mat, item)
  })
  return [...materiales.values()].sort((a, b) => (a.codigo ?? 0) - (b.codigo ?? 0))
}

export function PrefacturarPage() {
  const ecas = useQuery(ecasService.list)
  const [ecaId, setEcaId] = useState('')
  const [ventaDesde, setVentaDesde] = useState(inicioMes)
  const [ventaHasta, setVentaHasta] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoPrefactura | null>(null)
  const [pdf, setPdf] = useState<Blob | null>(null)

  const limpiarResultado = () => {
    setResultado(null)
    setPdf(null)
  }

  const consultarVentas = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ecaId) {
      setError('Selecciona una ECA para consultar sus ventas.')
      return
    }
    if (ventaDesde > ventaHasta) {
      setError('La fecha inicial no puede ser posterior a la final.')
      return
    }

    setBusy(true)
    setError(null)
    setResultado(null)
    setPdf(null)
    try {
      const [reportes, listaEcas] = await Promise.all([
        reportesService.listAll({ id_eca: Number(ecaId), ventaDesde, ventaHasta }),
        ecas.data ? Promise.resolve(ecas.data) : ecasService.list(),
      ])
      const eca = listaEcas.find((item) => item.id_eca === Number(ecaId))
      if (!eca) throw new Error('No se encontró la ECA seleccionada.')
      if (!reportes.length) {
        setError('No se encontraron ventas para la ECA y el rango de fechas seleccionados.')
        return
      }
      const detalles = agruparPorMaterial(reportes)
      setResultado({
        eca,
        ventaDesde,
        ventaHasta,
        cantidadReportes: reportes.length,
        detalles,
        reportes,
        total: detalles.reduce((sum, item) => sum + item.total, 0),
      })
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron consultar las ventas'))
    } finally {
      setBusy(false)
    }
  }

  const generarPdf = async () => {
    if (!resultado || generandoPdf) return
    setGenerandoPdf(true)
    setError(null)
    try {
      const usuarios = await usuariosService.list()
      const administradorEca: Usuario | undefined = usuarios.find(
        (usuario) => usuario.perfil === 'Administrador Eca' && usuario.id_eca === resultado.eca.id_eca && usuario.activo,
      )
      if (!administradorEca) throw new Error('La ECA seleccionada no tiene un Administrador Eca activo asociado.')
      const numeroPrefactura = await reportesService.nextPrefacturaNumber()
      setPdf(await makePrefacturaPdf({
        numeroPrefactura,
        fechaEmision: todayISO(),
        eca: resultado.eca,
        administradorEca: {
          nombre: `${administradorEca.nomUser} ${administradorEca.apeUser}`.trim(),
          cedula: administradorEca.cedula,
          cargo: administradorEca.cargo,
          perfil: administradorEca.perfil,
        },
        ventaDesde: resultado.ventaDesde,
        ventaHasta: resultado.ventaHasta,
        reportes: resultado.reportes,
        total: resultado.total,
      }))
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo generar la prefactura'))
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <>
      <PageHeader title="Prefacturar" description="Genera un documento preliminar con las ventas de una ECA durante el periodo seleccionado." />
      <div className="grid gap-4">
        <GradientFrame innerClassName="px-5 py-4">
          <form onSubmit={(event) => void consultarVentas(event)} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="prefactura-eca" label="ECA" required>
              <Select value={ecaId} onValueChange={(value) => { setEcaId(value); limpiarResultado() }} disabled={busy || ecas.loading || !!ecas.error}>
                <SelectTrigger id="prefactura-eca" className="w-full"><SelectValue placeholder="Selecciona una ECA" /></SelectTrigger>
                <SelectContent>
                  {(ecas.data ?? []).map((eca) => <SelectItem key={eca.id_eca} value={String(eca.id_eca)}>{eca.nomEca ?? `ECA ${eca.id_eca}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="prefactura-desde" label="Venta desde" required>
              <Input id="prefactura-desde" type="date" value={ventaDesde} max={ventaHasta} onChange={(event) => { setVentaDesde(event.target.value); limpiarResultado() }} required disabled={busy} />
            </Field>
            <Field id="prefactura-hasta" label="Venta hasta" required>
              <Input id="prefactura-hasta" type="date" value={ventaHasta} min={ventaDesde} onChange={(event) => { setVentaHasta(event.target.value); limpiarResultado() }} required disabled={busy} />
            </Field>
            <Button type="submit" disabled={busy || ecas.loading || !!ecas.error || !ecas.data?.length}>
              <FileText aria-hidden="true" /> {busy ? 'Consultando…' : 'Consultar ventas'}
            </Button>
          </form>
          {ecas.error && <div className="mt-3 text-sm text-destructive">{ecas.error} <Button type="button" variant="outline" onClick={() => void ecas.reload()}>Reintentar</Button></div>}
          {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        </GradientFrame>

        {resultado && (
          <section className="grid gap-3 rounded-xl border bg-card p-4" aria-label="Resumen de prefactura">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{resultado.eca.nomEca ?? 'ECA'} · {resultado.ventaDesde} al {resultado.ventaHasta}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{resultado.cantidadReportes} ventas · {formatKg(resultado.detalles.reduce((sum, item) => sum + item.cantidad, 0))}</p>
              </div>
              <Button type="button" onClick={() => void generarPdf()} disabled={generandoPdf}>
                <FileText aria-hidden="true" /> {generandoPdf ? 'Generando PDF…' : 'Generar prefactura PDF'}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr><th className="px-3 py-2 font-medium">Material</th><th className="px-3 py-2 text-right font-medium">Cantidad (kg)</th><th className="px-3 py-2 text-right font-medium">Valor total</th></tr>
                </thead>
                <tbody>
                  {resultado.detalles.map((item) => (
                    <tr key={`${item.codigo}-${item.nombre}`} className="border-t">
                      <td className="px-3 py-2">{item.codigo == null ? '' : `${item.codigo} · `}{item.nombre}</td>
                      <td className="px-3 py-2 text-right">{formatKg(item.cantidad)}</td>
                      <td className="px-3 py-2 text-right">{formatCOP(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-primary/5 font-semibold">
                  <tr><th colSpan={2} className="px-3 py-2 text-right">Total</th><td className="px-3 py-2 text-right">{formatCOP(resultado.total)}</td></tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Documento preliminar: no marca ni modifica los reportes de venta.</p>
          </section>
        )}
      </div>
      <PdfPreviewDialog
        open={!!pdf}
        onOpenChange={(open) => !open && setPdf(null)}
        title="Prefactura de ventas"
        description="Documento preliminar para revisar, descargar o imprimir."
        filename={`prefactura-eca-${resultado?.eca.id_eca ?? ecaId}-${resultado?.ventaDesde ?? ventaDesde}-${resultado?.ventaHasta ?? ventaHasta}.pdf`}
        blob={pdf}
      />
    </>
  )
}
