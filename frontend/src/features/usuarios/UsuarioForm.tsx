import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { describedBy } from '@/components/common/Field'
import { FormRow, FormSection } from '@/components/common/FormSection'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { ecasService } from '@/services/ecas.service'
import { usuariosService } from '@/services/usuarios.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Usuario } from '@/types/api'
import { editarUsuarioSchema, usuarioSchema, type UsuarioValues } from './schemas'

const EMPTY: UsuarioValues = { nomUser: '', apeUser: '', usuario: '', clave: '', cedula: '', id_perfil: '', id_cargo: '', id_eca: '' }

const PERFIL_AYUDA: Record<string, string> = {
  Administrador: 'Acceso completo.',
  Coordinador: 'Consulta, creación y edición en todos los módulos, sin eliminar ni gestionar Administradores.',
  Operario: 'Solo crear y consultar sus registros en el módulo Crear Reporte.',
  'Administrador Eca': 'Solo crea reportes de venta en su ECA asociada, sin consultar ni editar registros guardados.',
}

interface UsuarioFormProps {
  usuario?: Usuario | null
  onSaved: (u: Usuario) => void
  onCancel?: () => void
}

const toValues = (u: Usuario): UsuarioValues => ({
  nomUser: u.nomUser ?? '',
  apeUser: u.apeUser ?? '',
  usuario: u.usuario ?? '',
  clave: '',
  cedula: u.cedula === null ? '' : String(u.cedula),
  id_perfil: u.id_perfil === null ? '' : String(u.id_perfil),
  id_cargo: u.id_cargo === null ? '' : String(u.id_cargo),
  id_eca: u.id_eca === null ? '' : String(u.id_eca),
})

export function UsuarioForm({ usuario, onSaved, onCancel }: UsuarioFormProps) {
  const me = useAuthStore((s) => s.user)
  const editing = !!usuario
  const roles = useQuery(usuariosService.roles)
  const cargos = useQuery(usuariosService.cargos)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioValues>({
    resolver: zodResolver(editing ? editarUsuarioSchema : usuarioSchema),
    defaultValues: usuario ? toValues(usuario) : EMPTY,
  })

  useEffect(() => {
    reset(usuario ? toValues(usuario) : EMPTY)
  }, [usuario, reset])

  const perfilId = useWatch({ control, name: 'id_perfil' })
  const perfilSeleccionado = roles.data?.find((r) => String(r.id_perfil) === perfilId)?.perfil
  const requiereEca = perfilSeleccionado === 'Administrador Eca'
  const ecas = useQuery(ecasService.list, requiereEca)

  const onSubmit = async (v: UsuarioValues) => {
    if (requiereEca && !v.id_eca) {
      setError('id_eca', { message: 'Selecciona la ECA asociada' })
      return
    }
    try {
      const input = {
        usuario: v.usuario,
        nomUser: v.nomUser,
        apeUser: v.apeUser,
        cedula: Number(v.cedula),
        id_perfil: Number(v.id_perfil),
        id_cargo: v.id_cargo ? Number(v.id_cargo) : undefined,
        id_eca: requiereEca ? Number(v.id_eca) : undefined,
      }
      const saved = usuario
        ? await usuariosService.update(usuario.id_user, { ...input, ...(v.clave ? { clave: v.clave } : {}) })
        : await usuariosService.create({ ...input, clave: v.clave })
      useAuthStore.setState((state) => state.user?.id_user === saved.id_user ? { user: saved } : {})
      toast.success(`Usuario "${saved.usuario}" ${editing ? 'actualizado' : 'creado'} correctamente.`)
      if (!editing) reset(EMPTY)
      onSaved(saved)
    } catch (error) {
      if (getErrorStatus(error) === 409) setError('usuario', { message: 'Este usuario o cédula ya existe' })
      toast.error(getErrorMessage(error, editing ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario'))
    }
  }

  return (
    <GradientFrame innerClassName="px-6 py-5">
        <QueryState
          loading={roles.loading || cargos.loading}
          error={roles.error ?? cargos.error}
          isEmpty={false}
          onRetry={() => {
            void roles.reload()
            void cargos.reload()
          }}
          emptyTitle=""
          rows={3}
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={editing ? 'Editar usuario' : 'Nuevo usuario'}>
            <FormSection title={editing ? 'Editar usuario' : 'Información básica'}>
              <FormRow id="nomUser" htmlFor="nomUser" label="Nombre" description="Nombres del usuario" error={errors.nomUser?.message} required>
                <Input id="nomUser" autoComplete="off" aria-invalid={!!errors.nomUser} aria-describedby={describedBy('nomUser', errors.nomUser?.message)} {...register('nomUser')} />
              </FormRow>
              <FormRow id="apeUser" htmlFor="apeUser" label="Apellido" description="Apellidos del usuario" error={errors.apeUser?.message} required>
                <Input id="apeUser" autoComplete="off" aria-invalid={!!errors.apeUser} aria-describedby={describedBy('apeUser', errors.apeUser?.message)} {...register('apeUser')} />
              </FormRow>
              <FormRow id="usuario-nuevo" htmlFor="usuario-nuevo" label="Usuario" description="Nombre para iniciar sesión" error={errors.usuario?.message} required>
                <Input
                  id="usuario-nuevo"
                  autoComplete="off"
                  aria-invalid={!!errors.usuario}
                  aria-describedby={describedBy('usuario-nuevo', errors.usuario?.message)}
                  {...register('usuario')}
                />
              </FormRow>
              <FormRow id="clave-nueva" htmlFor="clave-nueva" label={editing ? 'Nueva clave (opcional)' : 'Clave inicial'} error={errors.clave?.message} description={editing ? 'Déjala vacía para conservarla. Mínimo 8 caracteres con mayúscula, minúscula y número.' : 'Mínimo 8 caracteres con mayúscula, minúscula y número.'} required={!editing}>
                <Input
                  id="clave-nueva"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.clave}
                  aria-describedby={describedBy('clave-nueva', errors.clave?.message)}
                  {...register('clave')}
                />
              </FormRow>
              <FormRow id="cedula-usuario" htmlFor="cedula-usuario" label="Cédula" description="Solo números, sin puntos" error={errors.cedula?.message} required>
                <Input
                  id="cedula-usuario"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={!!errors.cedula}
                  aria-describedby={describedBy('cedula-usuario', errors.cedula?.message)}
                  {...register('cedula')}
                />
              </FormRow>
              <FormRow
                id="id_perfil"
                htmlFor="id_perfil"
                label="Perfil"
                error={errors.id_perfil?.message}
                description={perfilSeleccionado ? PERFIL_AYUDA[perfilSeleccionado] : undefined}
                required
              >
                <Controller
                  control={control}
                  name="id_perfil"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={usuario?.id_user === me?.id_user}>
                      <SelectTrigger
                        id="id_perfil"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={!!errors.id_perfil}
                        aria-describedby={describedBy('id_perfil', errors.id_perfil?.message)}
                      >
                        <SelectValue placeholder="Selecciona un perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.data?.filter((r) => me?.perfil === 'Administrador' || r.perfil !== 'Administrador').map((r) => (
                          <SelectItem key={r.id_perfil} value={String(r.id_perfil)}>
                            {r.perfil}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormRow>
              {requiereEca && (
                <FormRow
                  id="id_eca"
                  htmlFor="id_eca"
                  label="ECA asociada"
                  description={ecas.error ?? 'ECA en la que registrará sus ventas'}
                  error={errors.id_eca?.message}
                  required
                >
                  <Controller
                    control={control}
                    name="id_eca"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={ecas.loading}>
                        <SelectTrigger
                          id="id_eca"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          aria-invalid={!!errors.id_eca}
                          aria-describedby={describedBy('id_eca', errors.id_eca?.message)}
                        >
                          <SelectValue placeholder={ecas.loading ? 'Cargando…' : 'Selecciona una ECA'} />
                        </SelectTrigger>
                        <SelectContent>
                          {ecas.data?.map((e) => (
                            <SelectItem key={e.id_eca} value={String(e.id_eca)}>
                              {e.nomEca ?? `ECA ${e.id_eca}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormRow>
              )}
              <FormRow id="id_cargo" htmlFor="id_cargo" label="Cargo (opcional)">
                <Controller
                  control={control}
                  name="id_cargo"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="id_cargo" ref={field.ref} onBlur={field.onBlur}>
                        <SelectValue placeholder="Selecciona un cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {cargos.data?.map((c) => (
                          <SelectItem key={c.id_cargo} value={String(c.id_cargo)}>
                            {c.cargo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormRow>
            </FormSection>
            <div className="flex flex-wrap justify-end gap-2 border-t border-dashed pt-4">
              {editing && onCancel && <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}><X /> Cancelar</Button>}
              <Button type="submit" disabled={isSubmitting}>
                {editing ? <Save /> : <UserPlus />} {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </QueryState>
    </GradientFrame>
  )
}
import { useEffect } from 'react'
