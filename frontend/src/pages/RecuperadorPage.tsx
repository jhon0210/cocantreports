import { useState } from 'react'
import { Info, ListChecks, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { PdfPreviewDialog } from '@/components/common/PdfPreviewDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RecuperadorForm } from '@/features/caracterizar/RecuperadorForm'
import { RecuperadoresTable } from '@/features/caracterizar/RecuperadoresTable'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { fullName } from '@/lib/format'
import { ACCESS, canAccess } from '@/lib/permissions'
import { makeCarnetPdf } from '@/lib/pdf-lazy'
import { recuperadoresService } from '@/services/recuperadores.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Recuperador } from '@/types/api'

interface CarnetState {
  blob: Blob
  recuperador: Recuperador
}

type TabValue = 'caracterizar' | 'editar'

export function RecuperadorPage() {
  const perfil = useAuthStore((s) => s.user?.perfil)
  const canWrite = canAccess(perfil, ACCESS.caracterizarEscritura)
  const canDelete = canAccess(perfil, ACCESS.eliminar)
  const recuperadores = useQuery(recuperadoresService.list)
  const [tab, setTab] = useState<TabValue>(canWrite ? 'caracterizar' : 'editar')
  const [carnet, setCarnet] = useState<CarnetState | null>(null)
  const [carnetOpen, setCarnetOpen] = useState(false)
  const [editing, setEditing] = useState<Recuperador | null>(null)
  const [toDelete, setToDelete] = useState<Recuperador | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showCarnet = (blob: Blob, recuperador: Recuperador) => {
    setCarnet({ blob, recuperador })
    setCarnetOpen(true)
  }

  // El listado no incluye la foto: se consulta el detalle completo antes de editar.
  const startEdit = async (r: Recuperador) => {
    try {
      setEditing(await recuperadoresService.getById(r.id_recuperador))
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo cargar el recuperador'))
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await recuperadoresService.remove(toDelete.id_recuperador)
      toast.success(`Recuperador ${fullName(toDelete.nombre, toDelete.apellido)} eliminado.`)
      void recuperadores.reload()
    } catch (e) {
      toast.error(getErrorMessage(e, 'No se pudo eliminar el recuperador'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <PageHeader title="Caracterizar · Recuperador" description="Registro, edición y eliminación de recuperadores, con su foto y carnet." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList aria-label="Opciones de recuperador">
          <TabsTrigger value="caracterizar">
            <UserPlus aria-hidden="true" /> Caracterizar Recuperador
          </TabsTrigger>
          <TabsTrigger value="editar">
            <ListChecks aria-hidden="true" /> Editar Información
            {recuperadores.data && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {recuperadores.data.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="caracterizar" className="animate-fade-in">
          {canWrite ? (
            <RecuperadorForm
              onSaved={(saved) => {
                void recuperadores.reload()
                void makeCarnetPdf(saved).then(
                  (blob) => showCarnet(blob, saved),
                  (e) => toast.error(getErrorMessage(e, 'No se pudo generar el carnet')),
                )
              }}
            />
          ) : (
            <Alert>
              <Info />
              <AlertDescription>
                Solo Administradores y Coordinadores pueden registrar y editar recuperadores. La eliminación es exclusiva del Administrador.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="editar" className="animate-fade-in">
          <RecuperadoresTable
            recuperadores={recuperadores.data}
            loading={recuperadores.loading}
            error={recuperadores.error}
            onRetry={() => void recuperadores.reload()}
            onCarnet={showCarnet}
            onEdit={canWrite ? (r) => void startEdit(r) : undefined}
            onDelete={canDelete ? setToDelete : undefined}
            editingId={editing?.id_recuperador}
          />
        </TabsContent>
      </Tabs>

      {/* Edición: el mismo formulario, dentro de un diálogo */}
      <Dialog open={!!editing} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Editar recuperador</DialogTitle>
          <DialogDescription className="sr-only">Modifica los datos del recuperador y guarda los cambios.</DialogDescription>
          {editing && (
            <RecuperadorForm
              recuperador={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                void recuperadores.reload()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Eliminar recuperador"
        description={
          <>
            Se eliminará a <strong>{toDelete ? fullName(toDelete.nombre, toDelete.apellido) : ''}</strong> (cédula {toDelete?.cedula}). Si ya tiene ventas
            registradas no se podrá eliminar; en ese caso cambia su estado a Inactivo.
          </>
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />

      <PdfPreviewDialog
        open={carnetOpen}
        onOpenChange={setCarnetOpen}
        title={carnet ? `Carnet de ${carnet.recuperador.nombre} ${carnet.recuperador.apellido}` : 'Carnet'}
        description="Carnet listo para imprimir (85,6 × 54 mm)."
        filename={`carnet-${carnet?.recuperador.cedula ?? 'recuperador'}.pdf`}
        blob={carnet?.blob ?? null}
      />
    </>
  )
}
