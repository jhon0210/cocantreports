import { useState } from 'react'
import { Info, ListChecks, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EcaForm } from '@/features/caracterizar/EcaForm'
import { EcasTable } from '@/features/caracterizar/EcasTable'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { ACCESS, canAccess } from '@/lib/permissions'
import { ecasService } from '@/services/ecas.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Eca } from '@/types/api'

export function EcaPage() {
  const perfil = useAuthStore((s) => s.user?.perfil)
  const canWrite = canAccess(perfil, ACCESS.caracterizarEscritura)
  const canDelete = canAccess(perfil, ACCESS.eliminar)
  const ecas = useQuery(ecasService.list)
  const [tab, setTab] = useState(canWrite ? 'caracterizar' : 'editar')
  const [editing, setEditing] = useState<Eca | null>(null)
  const [toDelete, setToDelete] = useState<Eca | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await ecasService.remove(toDelete.id_eca)
      toast.success(`ECA "${toDelete.nomEca}" eliminada.`)
      void ecas.reload()
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo eliminar la ECA'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <PageHeader title="Caracterizar · ECA" description="Registro de estaciones de clasificación y aprovechamiento." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Opciones de ECA">
          <TabsTrigger value="caracterizar">
            <Warehouse aria-hidden="true" /> Caracterizar ECA
          </TabsTrigger>
          <TabsTrigger value="editar">
            <ListChecks aria-hidden="true" /> Editar Información
            {ecas.data && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {ecas.data.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="caracterizar" className="animate-fade-in">
          {canWrite ? (
            <EcaForm onSaved={() => void ecas.reload()} />
          ) : (
            <Alert>
              <Info />
              <AlertDescription>
                Solo Administradores y Coordinadores pueden registrar y editar ECAs. La eliminación es exclusiva del Administrador.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        <TabsContent value="editar" className="animate-fade-in">
          <EcasTable
            ecas={ecas.data}
            loading={ecas.loading}
            error={ecas.error}
            onRetry={() => void ecas.reload()}
            onEdit={canWrite ? setEditing : undefined}
            onDelete={canDelete ? setToDelete : undefined}
            editingId={editing?.id_eca}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Editar ECA</DialogTitle>
          <DialogDescription className="sr-only">Modifica los datos de la ECA y guarda los cambios.</DialogDescription>
          {editing && (
            <EcaForm
              key={editing.id_eca}
              eca={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                void ecas.reload()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Eliminar ECA"
        description={<>Se eliminará la ECA <strong>{toDelete?.nomEca}</strong>. Solo se permite si no tiene reportes de ventas vinculados.</>}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
