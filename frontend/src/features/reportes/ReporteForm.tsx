import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { CurrencyInput } from '@/components/common/CurrencyInput'
import { describedBy } from '@/components/common/Field'
import { FormRow, FormSection } from '@/components/common/FormSection'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage } from '@/lib/errors'
import { todayISO } from '@/lib/format'
import { ecasService } from '@/services/ecas.service'
import { materialesService } from '@/services/materiales.service'
import type { Eca, Material } from '@/types/api'
import { reporteSchema, type ReporteValues } from './schemas'
import { MaterialCards } from './MaterialCards'

export interface RegistroVenta {
  values: ReporteValues
  material: Material
  eca: Eca
}

interface ReporteFormProps {
  initialValues?: ReporteValues
  /** Solo al registrar una venta nueva: ECA elegida en la información del recuperador. */
  ecaId?: string
  macrorutaId?: string
  onSubmitValues: (registro: RegistroVenta) => void | Promise<void>
  onCancel?: () => void
}

export function ReporteForm({ initialValues, ecaId = '', macrorutaId = '', onSubmitValues, onCancel }: ReporteFormProps) {
  const materiales = useQuery(materialesService.list)
  const ecas = useQuery(ecasService.list)
  const hoy = useMemo(() => todayISO(), [])
  const creating = !initialValues

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReporteValues>({
    resolver: zodResolver(reporteSchema),
    defaultValues: initialValues ?? { id_mat: '', id_eca: ecaId, cantidad: undefined, valor: undefined, FechaVenta: '' },
  })

  useEffect(() => {
    if (creating) {
      setValue('id_eca', ecaId)
      setValue('id_eca_macroruta', macrorutaId)
    }
  }, [creating, ecaId, macrorutaId, setValue])

  const idMat = useWatch({ control, name: 'id_mat' })
  const material = materiales.data?.find((m) => String(m.id_mat) === idMat)

  const onSubmit = async (values: ReporteValues) => {
    try {
      const eca = ecas.data?.find((e) => String(e.id_eca) === values.id_eca)
      if (!material || !eca) {
        toast.error('El material o la ECA ya no están disponibles. Actualiza los catálogos.')
        return
      }
      await onSubmitValues({
        values: {
          ...values,
          ...(creating ? { id_eca_macroruta: eca.macroruta ? values.id_eca : '' } : {}),
          FechaVenta: creating ? todayISO() : values.FechaVenta || todayISO(),
        },
        material,
        eca,
      })
      if (creating) reset({ id_mat: '', id_eca: values.id_eca, id_eca_macroruta: macrorutaId, cantidad: undefined, valor: undefined, FechaVenta: '' })
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo guardar el registro'))
    }
  }

  return (
    <GradientFrame innerClassName="px-4 py-4 sm:px-6">
        <QueryState
          loading={materiales.loading || ecas.loading}
          error={materiales.error ?? ecas.error}
          isEmpty={materiales.data?.length === 0 || ecas.data?.length === 0}
          onRetry={() => {
            void materiales.reload()
            void ecas.reload()
          }}
          emptyTitle="Faltan materiales o ECAs configurados"
          rows={2}
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={initialValues ? 'Editar registro de venta' : 'Registrar venta'}>
            <FormSection title={initialValues ? 'Editar registro de venta' : 'Registrar venta'}>
            <FormRow
              className="py-2 md:grid-cols-1 md:gap-2"
              id="id_mat"
              htmlFor="id_mat"
              label="Material"
              error={errors.id_mat?.message}
              required
            >
              {creating && !ecaId && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                  Selecciona la ECA en «Información del recuperador» para registrar la venta.
                </p>
              )}
              <Controller
                control={control}
                name="id_mat"
                render={({ field }) => (
                  <MaterialCards
                    id="id_mat"
                    materiales={materiales.data ?? []}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={creating && !ecaId}
                    invalid={!!errors.id_mat}
                    describedBy={describedBy('id_mat', errors.id_mat?.message)}
                  />
                )}
              />
              {material && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Material: <span className="font-medium text-foreground">{material.nomMaterial}</span>
                </p>
              )}
            </FormRow>

            {material && (
              <>
                {!creating && (
                  <FormRow
                    className="py-2 md:grid-cols-[11rem_1fr] md:gap-4"
                    id="id_eca"
                    htmlFor="id_eca"
                    label="ECA donde vendió"
                    error={errors.id_eca?.message}
                    required
                  >
                    <Controller
                      control={control}
                      name="id_eca"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="id_eca"
                            ref={field.ref}
                            onBlur={field.onBlur}
                            aria-invalid={!!errors.id_eca}
                            aria-describedby={describedBy('id_eca', errors.id_eca?.message)}
                          >
                            <SelectValue placeholder="Selecciona una ECA" />
                          </SelectTrigger>
                          <SelectContent>
                            {ecas.data?.map((e) => (
                              <SelectItem key={e.id_eca} value={String(e.id_eca)}>
                                {e.nomEca}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormRow>
                )}

                {!creating && (
                  <FormRow id="editar-macroruta" htmlFor="editar-macroruta" label="Código y nombre de macroruta">
                    <Controller control={control} name="id_eca_macroruta" render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                        <SelectTrigger id="editar-macroruta"><SelectValue placeholder="Selecciona una macroruta" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin especificar</SelectItem>
                          {ecas.data?.filter((e) => e.macroruta).map((e) => <SelectItem key={e.id_eca} value={String(e.id_eca)}>{e.macroruta} — {e.nomEca}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </FormRow>
                )}

                {!creating && (
                  <FormRow className="py-2 md:grid-cols-[11rem_1fr] md:gap-4" id="FechaVenta" htmlFor="FechaVenta" label="Fecha de venta (opcional)" error={errors.FechaVenta?.message} description="Si la dejas vacía se usa hoy.">
                    <Input
                      id="FechaVenta"
                      type="date"
                      max={hoy}
                      aria-invalid={!!errors.FechaVenta}
                      aria-describedby={describedBy('FechaVenta', errors.FechaVenta?.message)}
                      {...register('FechaVenta')}
                    />
                  </FormRow>
                )}

                <FormRow className="py-2 md:grid-cols-[11rem_1fr] md:gap-4" id="cantidad" htmlFor="cantidad" label="Cantidad vendida (kg)" error={errors.cantidad?.message} required>
                  <Input
                    id="cantidad"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0"
                    aria-invalid={!!errors.cantidad}
                    aria-describedby={describedBy('cantidad', errors.cantidad?.message)}
                    {...register('cantidad', { valueAsNumber: true })}
                  />
                </FormRow>

                <FormRow className="py-2 md:grid-cols-[11rem_1fr] md:gap-4" id="valor" htmlFor="valor" label="Valor unitario (COP por kg)" error={errors.valor?.message} required>
                  <Controller
                    control={control}
                    name="valor"
                    render={({ field }) => (
                      <CurrencyInput
                        id="valor"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="0"
                        aria-invalid={!!errors.valor}
                        aria-describedby={describedBy('valor', errors.valor?.message)}
                      />
                    )}
                  />
                </FormRow>
              </>
            )}
            </FormSection>
            {material && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-dashed pt-4">
                {onCancel && <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}><X /> Cancelar</Button>}
                <Button type="submit" disabled={isSubmitting}>
                  {initialValues ? <Save /> : <Plus />} {isSubmitting ? 'Guardando…' : initialValues ? 'Guardar cambios' : 'Agregar Registro'}
                </Button>
              </div>
            )}
          </form>
        </QueryState>
    </GradientFrame>
  )
}
