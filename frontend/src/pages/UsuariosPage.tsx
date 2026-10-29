import { PageHeader } from '@/components/common/PageHeader'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsuarioForm } from '@/features/usuarios/UsuarioForm'
import { UsuariosTable } from '@/features/usuarios/UsuariosTable'
import { useQuery } from '@/hooks/useQuery'
import { usuariosService } from '@/services/usuarios.service'
import { getErrorMessage } from '@/lib/errors'
import type { Usuario } from '@/types/api'

export function UsuariosPage() {
  const usuarios = useQuery(usuariosService.list)
  const reload = () => void usuarios.reload()
  const [tab, setTab] = useState('crear')
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [toDelete, setToDelete] = useState<Usuario | null>(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await usuariosService.remove(toDelete.id_user)
      toast.success(`Usuario "${toDelete.usuario}" desactivado.`)
      reload()
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo desactivar el usuario'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <>
      <PageHeader title="Usuarios" description="Registro de usuarios y asignación de perfiles." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Opciones de usuarios">
          <TabsTrigger value="crear"><UserPlus aria-hidden="true" /> Crear Usuario</TabsTrigger>
          <TabsTrigger value="editar">
            <ListChecks aria-hidden="true" /> Editar Información
            {usuarios.data && <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{usuarios.data.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="crear" className="animate-fade-in">
          <UsuarioForm onSaved={reload} />
        </TabsContent>
        <TabsContent value="editar" className="animate-fade-in">
          <UsuariosTable usuarios={usuarios.data} loading={usuarios.loading} error={usuarios.error} onRetry={reload} onChanged={reload} onEdit={setEditing} onDelete={setToDelete} editingId={editing?.id_user} />
        </TabsContent>
      </Tabs>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <DialogTitle className="sr-only">Editar usuario</DialogTitle>
          <DialogDescription className="sr-only">Modifica los datos del usuario y guarda los cambios.</DialogDescription>
          {editing && <UsuarioForm usuario={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminar usuario (desactivar)"
        description={<>Se desactivará la cuenta <strong>{toDelete?.usuario}</strong> y se revocarán sus sesiones. No podrá iniciar sesión, pero conservará su historial y podrá reactivarse.</>}
        confirmLabel="Desactivar"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
import { useState } from 'react'
import { ListChecks, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
