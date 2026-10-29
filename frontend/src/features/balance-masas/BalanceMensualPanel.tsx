import { useState, type FormEvent } from 'react'
import { Field } from '@/components/common/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { exportResumenBalance } from '@/lib/balance-mensual'
import { balanceMasasService, type ResumenBalance } from '@/services/balance-masas.service'
import { materialesService } from '@/services/materiales.service'

interface Props {
  periodo: string
  idEca?: number
  filas: ResumenBalance[]
  onSaved: () => Promise<void>
  onBusyChange: (busy: boolean) => void
}

const vacio = () => ({ inicial: '', salidas: '', rechazos: '', cat: '', soportes: '', receptor: '', observaciones: '', confirmado: false })
const peso = (value: number | null | undefined) => value == null ? 'Pendiente' : value.toLocaleString('es-CO', { maximumFractionDigits: 3 })

export function BalanceMensualPanel({ periodo, idEca, filas, onSaved, onBusyChange }: Props) {
  const materiales = useQuery(materialesService.list)
  const [material, setMaterial] = useState('')
  const [form, setForm] = useState(vacio)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const seleccionada = filas.find((f) => f.id_eca === idEca && f.id_mat === Number(material))
  const cambiarMaterial = (value: string) => {
    setMaterial(value)
    setError(null)
    setMensaje(null)
    const fila = filas.find((f) => f.id_eca === idEca && f.id_mat === Number(value))
    const c = fila?.captura
    setForm({
      inicial: c ? String(c.inventario_inicial_kg) : fila?.inventario_anterior_kg == null ? '' : String(fila.inventario_anterior_kg),
      salidas: c ? String(c.salidas_kg) : '', rechazos: c ? String(c.rechazos_kg) : '',
      cat: c?.entradas_cat_kg == null ? '' : String(c.entradas_cat_kg),
      soportes: c?.soporte_salidas ?? '', receptor: c?.receptor_rechazos ?? '', observaciones: c?.observaciones ?? '', confirmado: false,
    })
  }
  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMensaje(null)
    if (!idEca || !material) { setError('Selecciona una ECA y un material'); return }
    const convertir = (value: string) => value.trim() !== '' && /^\d+(\.\d{1,3})?$/.test(value) && Number(value) <= 1_000_000_000
    if (![form.inicial, form.salidas, form.rechazos].every(convertir) || (form.cat !== '' && !convertir(form.cat))) {
      setError('Ingresa cantidades no negativas con hasta tres decimales en kg. No dejes en blanco inventario, salidas ni rechazos.')
      return
    }
    if (!form.confirmado) { setError('Confirma que las cantidades están medidas y soportadas'); return }
    setBusy(true)
    onBusyChange(true)
    let guardado = false
    try {
      await balanceMasasService.guardar({
        periodo, id_eca: idEca, id_mat: Number(material),
        inventario_inicial_kg: Number(form.inicial), salidas_kg: Number(form.salidas), rechazos_kg: Number(form.rechazos),
        entradas_cat_kg: form.cat === '' ? null : Number(form.cat),
        entradas_esperadas_kg: seleccionada?.entradas_kg ?? 0,
        soporte_salidas: form.soportes.trim() || null, receptor_rechazos: form.receptor.trim() || null,
        observaciones: form.observaciones.trim() || null, version: seleccionada?.captura?.version ?? null,
        mediciones_confirmadas: form.confirmado,
      })
      guardado = true
      await onSaved()
      setMaterial('')
      setForm(vacio())
      setMensaje('Captura mensual guardada. El resultado sigue siendo un borrador interno, no una certificación SUI.')
    } catch (err) {
      setError(`${guardado ? 'La captura quedó guardada, pero no se pudo actualizar la consulta. Vuelve a consultar. ' : ''}${getErrorMessage(err, 'No se pudo guardar la captura mensual')}`)
    } finally { setBusy(false); onBusyChange(false) }
  }
  const exportar = async () => {
    setError(null)
    setBusy(true)
    onBusyChange(true)
    try { await exportResumenBalance(filas, periodo) }
    catch (err) { setError(getErrorMessage(err, 'No se pudo exportar el resumen mensual')) }
    finally { setBusy(false); onBusyChange(false) }
  }
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Balance mensual interno · {periodo}</h3>
        <Button type="button" variant="outline" disabled={busy || !filas.length} onClick={() => void exportar()}>Exportar resumen mensual</Button>
      </div>
      <p className="text-sm text-muted-foreground">Inventario final = inicial + entradas − salidas efectivas − rechazos. La prefactura consolida recepciones y no se descuenta como salida. Todas las capturas se hacen en kg.</p>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {mensaje && <Alert><AlertDescription>{mensaje}</AlertDescription></Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{['ECA', 'Material', 'Inicial (kg)', 'Entradas (kg)', 'CAT incluido (kg)', 'Salidas (kg)', 'Rechazos (kg)', 'Final (kg)', 'Novedades'].map((h) => <th key={h} className="min-w-28 border bg-primary/10 p-2 text-left">{h}</th>)}</tr></thead>
          <tbody>{filas.map((f) => <tr key={`${f.id_eca}:${f.id_mat}`}>
            <td className="border p-2">{f.eca}</td><td className="border p-2">{f.codigo ?? '—'} · {f.material}</td>
            {[f.captura?.inventario_inicial_kg, f.entradas_kg, f.captura?.entradas_cat_kg, f.captura?.salidas_kg, f.captura?.rechazos_kg, f.inventario_final_kg].map((v, i) => <td key={i} className="border p-2">{peso(v)}</td>)}
            <td className="min-w-64 border p-2 text-xs">{f.novedades.length ? f.novedades.join(' · ') : 'Sin diferencias aritméticas; revisión normativa pendiente'}</td>
          </tr>)}</tbody>
        </table>
        {!filas.length && <p className="py-2 text-sm text-muted-foreground">Sin entradas ni capturas. Puedes registrar inventario inicial para un material.</p>}
      </div>
      {!idEca ? <p className="text-sm text-muted-foreground">Selecciona una ECA específica y consulta para registrar o corregir cantidades.</p> : (
        <form onSubmit={(event) => void guardar(event)} className="grid gap-3 sm:grid-cols-2">
          <h4 className="font-semibold sm:col-span-2">Capturar o corregir totales del mes por material</h4>
          {materiales.error && <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{materiales.error} <Button type="button" variant="outline" onClick={() => void materiales.reload()}>Reintentar</Button></AlertDescription></Alert>}
          <Field id="balance-material" label="Material" required>
            <Select value={material} onValueChange={cambiarMaterial} disabled={busy || materiales.loading || !!materiales.error}>
              <SelectTrigger id="balance-material"><SelectValue placeholder="Selecciona el material" /></SelectTrigger>
              <SelectContent>{materiales.data?.map((m) => <SelectItem key={m.id_mat} value={String(m.id_mat)}>{m.codigo ?? '—'} · {m.nomMaterial}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <p className="self-end pb-2 text-sm">Entradas según reportes: {peso(seleccionada?.entradas_kg ?? 0)} kg. Saldo del mes anterior: {peso(seleccionada?.inventario_anterior_kg)} kg.</p>
          {([
            ['inicial', 'Inventario inicial (kg)'], ['salidas', 'Salidas efectivamente aprovechadas (kg)'],
            ['rechazos', 'Rechazos medidos (kg)'], ['cat', 'De las entradas, procedente de CAT (kg, opcional)'],
          ] as const).map(([key, label]) => <Field key={key} id={`balance-${key}`} label={label} required={key !== 'cat'}>
            <Input id={`balance-${key}`} type="number" min="0" max="1000000000" step="0.001" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== 'cat'} disabled={busy || !material} />
          </Field>)}
          <p className="text-xs text-muted-foreground sm:col-span-2">CAT ya está incluido en las entradas: no se suma otra vez. Si se desconoce, deja CAT vacío; indica 0 solo si se verificó que no hubo. El inventario inicial sugerido debe confirmarse; sin mes anterior será una declaración no conciliada.</p>
          <Field id="balance-soportes" label="Compradores y referencias de facturas de salida" required={Number(form.salidas) > 0}>
            <Input id="balance-soportes" maxLength={1000} value={form.soportes} onChange={(e) => setForm({ ...form, soportes: e.target.value })} required={Number(form.salidas) > 0} disabled={busy || !material} />
          </Field>
          <Field id="balance-receptor" label="Prestador receptor y referencia de entrega del rechazo" required={Number(form.rechazos) > 0}>
            <Input id="balance-receptor" maxLength={500} value={form.receptor} onChange={(e) => setForm({ ...form, receptor: e.target.value })} required={Number(form.rechazos) > 0} disabled={busy || !material} />
          </Field>
          <Field id="balance-observaciones" label="Observaciones">
            <Input id="balance-observaciones" maxLength={1000} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} disabled={busy || !material} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-primary" checked={form.confirmado} onChange={(e) => setForm({ ...form, confirmado: e.target.checked })} disabled={busy || !material} required />
            Confirmo que las cantidades están medidas y soportadas. Un cero significa ausencia verificada, no información desconocida.
          </label>
          <Button type="submit" disabled={busy || !material || materiales.loading || !!materiales.error}>{busy ? 'Procesando…' : 'Guardar captura mensual'}</Button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">No se modifica Crear Reporte ni Prefacturar. La placa habitual del recuperador no se atribuye a ingresos históricos. Las referencias ingresadas no validan por sí solas facturas DIAN ni el cumplimiento SUI.</p>
    </section>
  )
}
