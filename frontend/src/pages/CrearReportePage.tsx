import { useRef, useState } from 'react'
import { AlertCircle, FilePlus2, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { PdfPreviewDialog } from '@/components/common/PdfPreviewDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BuscarRecuperadorCard } from '@/features/reportes/BuscarRecuperadorCard'
import { CarnetRecuperador } from '@/features/reportes/CarnetRecuperador'
import { RegistrosPendientes, type RegistroPendiente } from '@/features/reportes/RegistrosPendientes'
import { ReporteForm, type RegistroVenta } from '@/features/reportes/ReporteForm'
import { ReportesTable } from '@/features/reportes/ReportesTable'
import type { ReporteValues } from '@/features/reportes/schemas'
import { useQuery } from '@/hooks/useQuery'
import { makeComprobantePdf } from '@/lib/pdf-lazy'
import { getErrorMessage } from '@/lib/errors'
import { ACCESS, canAccess } from '@/lib/permissions'
import { ecasService } from '@/services/ecas.service'
import { reportesService } from '@/services/reportes.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Recuperador, Reporte, UpdateReporteInput } from '@/types/api'
import { ESTADO_ACTIVO } from '@/types/api'

interface PdfState {
  blob: Blob
  filename: string
  title: string
}

const toInput = (v: ReporteValues): UpdateReporteInput => ({
  id_eca_macroruta: v.id_eca_macroruta ? Number(v.id_eca_macroruta) : null,
  id_mat: Number(v.id_mat),
  id_eca: Number(v.id_eca),
  cantidad: v.cantidad,
  valor: v.valor,
  FechaVenta: v.FechaVenta || undefined,
})

const toValues = (r: Reporte): ReporteValues => ({
  id_eca_macroruta: r.id_eca_macroruta ? String(r.id_eca_macroruta) : '',
  id_mat: String(r.id_mat),
  id_eca: String(r.id_eca),
  cantidad: r.cantidad,
  valor: r.valor,
  FechaVenta: r.FechaVenta,
})

export function CrearReportePage() {
  const user = useAuthStore((s) => s.user)
  const perfil = user?.perfil
  const canEdit = canAccess(perfil, ACCESS.editarReporte)
  const canDelete = canAccess(perfil, ACCESS.eliminar)
  const canSeeSaved = canAccess(perfil, ACCESS.reportesGuardados)
  const lockedEcaId = perfil === 'Administrador Eca' ? user?.id_eca ?? null : null
  const sinEca = perfil === 'Administrador Eca' && lockedEcaId === null
  const [ecaElegida, setEcaElegida] = useState('')
  const ecas = useQuery(ecasService.list)
  const ecaVenta = perfil === 'Administrador Eca' ? String(lockedEcaId ?? '') : ecaElegida
  const ecaSeleccionada = ecas.data?.find((e) => String(e.id_eca) === ecaVenta)
  const macrorutaVenta = ecaSeleccionada?.macroruta ? ecaVenta : ''
  const [tab, setTab] = useState('crear')
  const [recuperador, setRecuperador] = useState<Recuperador | null>(null)
  const [registros, setRegistros] = useState<RegistroPendiente[]>([])
  const [editingDraft, setEditingDraft] = useState<RegistroPendiente | null>(null)
  const [editing, setEditing] = useState<Reporte | null>(null)
  const [toDelete, setToDelete] = useState<Reporte | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [pdf, setPdf] = useState<PdfState | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const reportes = useQuery(reportesService.listAll, canSeeSaved)

  const showPdf = async (rows: Reporte[]) => {
    try {
      const first = rows[0]
      if (!first) throw new Error('El comprobante no contiene registros')
      setPdf({
        blob: await makeComprobantePdf(rows),
        filename: `comprobante-${first.comprobante ?? first.consecutivo}.pdf`,
        title: 'Comprobante de venta',
      })
      setPdfOpen(true)
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo generar el PDF.'))
    }
  }

  const saveBatch = async () => {
    if (savingRef.current || !registros.length) return
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await reportesService.createBatch(registros.map((r) => ({
        ...toInput(r.values),
        id_recuperador: r.recuperador.id_recuperador,
      })))
      setRegistros([])
      setConfirmOpen(false)
      toast.success('Comprobante guardado correctamente.')
      if (canSeeSaved) void reportes.reload()
      await showPdf(saved)
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo guardar el comprobante. Los registros pendientes se conservaron.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const deleteSaved = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await reportesService.remove(toDelete.consecutivo)
      toast.success(`Reporte N° ${toDelete.consecutivo} eliminado.`)
      void reportes.reload()
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo eliminar el reporte'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  const updateSaved = async ({ values }: RegistroVenta) => {
    if (!editing) return
    await reportesService.update(editing.consecutivo, toInput(values))
    toast.success(`Reporte N° ${editing.consecutivo} actualizado.`)
    setEditing(null)
    void reportes.reload()
  }

  if (sinEca) {
    return (
      <>
        <PageHeader title="Crear Reporte" description="Busca al recuperador por cédula y registra la venta de material." />
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Sin ECA asociada</AlertTitle>
          <AlertDescription>Tu cuenta no tiene una ECA asociada. Solicita a un Administrador o Coordinador que la asigne para registrar ventas.</AlertDescription>
        </Alert>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Crear Reporte" description="Busca al recuperador por cédula y registra la venta de material." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Opciones de reporte">
          <TabsTrigger value="crear"><FilePlus2 aria-hidden="true" /> Crear Reporte</TabsTrigger>
          {canSeeSaved && (
            <TabsTrigger value="editar">
              <ListChecks aria-hidden="true" /> Editar Información
              {reportes.data && <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{reportes.data.length}</span>}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="crear" className="animate-fade-in">
          <div className="grid gap-4">
            <BuscarRecuperadorCard onFound={setRecuperador} onNotFound={() => setRecuperador(null)} />
            {recuperador && (
              <>
                <CarnetRecuperador
                  key={recuperador.id_recuperador}
                  recuperador={recuperador}
                  macroruta={ecas.loading ? 'Cargando…' : ecas.error ? (
                    <span className="text-destructive">{ecas.error} <Button type="button" variant="outline" size="sm" onClick={() => void ecas.reload()}>Reintentar</Button></span>
                  ) : ecaSeleccionada?.macroruta
                    ? `${ecaSeleccionada.macroruta} — ${ecaSeleccionada.nomEca ?? 'ECA'}`
                    : ecaVenta ? 'La ECA no tiene macroruta configurada' : 'Selecciona una ECA'}
                  eca={perfil === 'Administrador Eca'
                    ? user?.eca ?? `ECA ${lockedEcaId}`
                    : (
                      <Select value={ecaElegida} onValueChange={setEcaElegida} disabled={ecas.loading || !!ecas.error}>
                        <SelectTrigger aria-label="ECA donde vendió" className="h-8 w-full min-w-48 sm:w-64">
                          <SelectValue placeholder={ecas.loading ? 'Cargando…' : ecas.error ? 'No se pudieron cargar las ECAs' : 'Selecciona una ECA'} />
                        </SelectTrigger>
                        <SelectContent>
                          {ecas.data?.map((e) => <SelectItem key={e.id_eca} value={String(e.id_eca)}>{e.nomEca ?? `ECA ${e.id_eca}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                />
                {recuperador.estado === ESTADO_ACTIVO ? (
                  <ReporteForm
                    key={`form-${recuperador.id_recuperador}`}
                    ecaId={ecaVenta}
                    macrorutaId={macrorutaVenta}
                    onSubmitValues={(registro) => {
                      setRegistros((prev) => [...prev, { ...registro, key: crypto.randomUUID(), recuperador }])
                    }}
                  />
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>No se pueden registrar ventas</AlertTitle>
                    <AlertDescription>El recuperador está en estado {recuperador.estado}. Solo los recuperadores Activos pueden registrar ventas.</AlertDescription>
                  </Alert>
                )}
              </>
            )}
            <RegistrosPendientes
              registros={registros}
              onEdit={setEditingDraft}
              onRemove={(key) => setRegistros((prev) => prev.filter((r) => r.key !== key))}
              onSave={() => setConfirmOpen(true)}
            />
          </div>
        </TabsContent>
        {canSeeSaved && (
          <TabsContent value="editar" className="animate-fade-in">
            <ReportesTable
              reportes={reportes.data}
              loading={reportes.loading}
              error={reportes.error}
              onRetry={() => void reportes.reload()}
              onEdit={canEdit ? setEditing : undefined}
              onDelete={canDelete ? setToDelete : undefined}
            />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-3 pr-12">
            <DialogTitle>Confirmar datos del reporte</DialogTitle>
            <DialogDescription>Revisa los datos antes de guardar. Se guardarán todos los registros o ninguno y después se abrirá el comprobante para imprimir.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-5 py-3">
            <Tabs defaultValue="resumen">
              <TabsList aria-label="Opciones de confirmación del reporte">
                <TabsTrigger value="resumen"><ListChecks aria-hidden="true" /> Reportes Registrados</TabsTrigger>
                <TabsTrigger value="detalle"><FilePlus2 aria-hidden="true" /> Ver detalle</TabsTrigger>
              </TabsList>
              <TabsContent value="resumen">
                <RegistrosPendientes registros={registros} view="summary" />
              </TabsContent>
              <TabsContent value="detalle">
                <RegistrosPendientes registros={registros} view="detail" />
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-3">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmOpen(false)}>Volver y corregir</Button>
            <Button type="button" disabled={saving} onClick={() => void saveBatch()}>{saving ? 'Guardando…' : 'Confirmar y guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDraft || !!editing} onOpenChange={(open) => { if (!open) { setEditingDraft(null); setEditing(null) } }}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Editar registro de venta</DialogTitle>
          <DialogDescription className="sr-only">Modifica los campos de la venta y guarda los cambios.</DialogDescription>
          {editingDraft && (
            <ReporteForm
              key={editingDraft.key}
              initialValues={editingDraft.values}
              onCancel={() => setEditingDraft(null)}
              onSubmitValues={(registro) => {
                setRegistros((prev) => prev.map((r) => r.key === editingDraft.key ? { ...r, ...registro } : r))
                setEditingDraft(null)
              }}
            />
          )}
          {editing && (
            <ReporteForm key={editing.consecutivo} initialValues={toValues(editing)} onCancel={() => setEditing(null)} onSubmitValues={updateSaved} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminar reporte"
        description={<>Se eliminará el registro N° {toDelete?.consecutivo}. Si pertenece a un comprobante con varios materiales, los demás registros se conservarán.</>}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void deleteSaved()}
      />
      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} title={pdf?.title ?? 'Reporte'} description="Comprobante de venta listo para imprimir." filename={pdf?.filename ?? 'reporte.pdf'} blob={pdf?.blob ?? null} />
    </>
  )
}
