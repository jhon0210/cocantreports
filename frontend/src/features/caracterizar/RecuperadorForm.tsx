import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { CameraCapture } from '@/components/common/CameraCapture'
import { CheckboxGroup } from '@/components/common/CheckboxGroup'
import { describedBy } from '@/components/common/Field'
import { FormRow, FormSection } from '@/components/common/FormSection'
import { GradientFrame } from '@/components/common/GradientFrame'
import { QueryState } from '@/components/common/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useQuery } from '@/hooks/useQuery'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { todayISO } from '@/lib/format'
import { recuperadoresService } from '@/services/recuperadores.service'
import type { Recuperador, UpdateRecuperadorInput } from '@/types/api'
import { calcularEdad, emptyValues, toInput, toValues } from './caracterizacion'
import {
  AFILIACIONES_SALUD,
  ESTADOS_CIVILES,
  ESTRATOS,
  GENEROS,
  GRUPOS_RH,
  JORNADAS,
  LUGARES_RECOLECCION,
  MATERIALES_RECUPERADOS,
  NIVELES_EDUCATIVOS,
  PERTENENCIAS_ETNICAS,
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_AYUDA,
  TRANSPORTES,
  USOS_EPP,
} from './opciones'
import { editarRecuperadorSchema, recuperadorSchema, type RecuperadorValues } from './schemas'
import { DocumentosRecuperador, type ArchivoRecuperador } from './DocumentosRecuperador'

interface RecuperadorFormProps {
  /** Si se indica, el formulario edita ese recuperador (debe traer la foto); si no, crea uno nuevo. */
  recuperador?: Recuperador | null
  onSaved: (recuperador: Recuperador, mode: 'created' | 'updated') => void
  onCancel?: () => void
}

type FieldOf<T> = { [K in keyof RecuperadorValues]: RecuperadorValues[K] extends T ? K : never }[keyof RecuperadorValues]
type TextField = FieldOf<string>
type BooleanField = FieldOf<boolean>
type ListField = FieldOf<string[]>

const NONE = '__none__'
const PASOS = ['Registro', 'Identificación', 'Socioeconómica', 'Actividad', 'Documentos', 'Autorización'] as const

const DEPENDIENTES = [
  ['dependientes_total', 'Total de dependientes'],
  ['dependientes_menores', 'Menores de edad'],
  ['dependientes_adultos_mayores', 'Adultos mayores'],
  ['dependientes_discapacidad', 'Personas con discapacidad'],
] as const

function SwitchControl({ control, name, id }: { control: Control<RecuperadorValues>; name: BooleanField; id: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-2">
          <Switch id={id} checked={field.value} onCheckedChange={field.onChange} />
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            {field.value ? 'Sí' : 'No'}
          </span>
        </div>
      )}
    />
  )
}

export function RecuperadorForm({ recuperador, onSaved, onCancel }: RecuperadorFormProps) {
  const editing = !!recuperador
  const estados = useQuery(recuperadoresService.estados)
  const [documentos, setDocumentos] = useState<ArchivoRecuperador[]>(recuperador?.documentos ?? [])
  const [leyendoDocumentos, setLeyendoDocumentos] = useState(false)
  const [paso, setPaso] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RecuperadorValues>({
    resolver: zodResolver(editing ? editarRecuperadorSchema : recuperadorSchema),
    defaultValues: recuperador ? toValues(recuperador) : emptyValues(),
    shouldFocusError: false,
    mode: 'onChange',
  })

  // Al cambiar de recuperador (o salir del modo edición) el formulario se reinicia.
  useEffect(() => {
    reset(recuperador ? toValues(recuperador) : emptyValues())
    setDocumentos(recuperador?.documentos ?? [])
    setPaso(0)
  }, [recuperador, reset])

  const [pertenece, tipoDocumento, nacimiento, discapacidad, victima, transporte, materiales] = useWatch({
    control,
    name: ['pertenece_organizacion', 'tipo_documento', 'fecha_nacimiento', 'discapacidad', 'victima_conflicto', 'transporte', 'materiales'],
  })
  const edad = calcularEdad(nacimiento)

  const onSubmit = async (v: RecuperadorValues) => {
    if (leyendoDocumentos) {
      toast.error('Espera a que termine la lectura del documento.')
      return
    }
    try {
      const { foto, ...input } = toInput(v)
      const adjuntos = documentos.map((d) => 'id' in d ? { id: d.id } : d)
      if (recuperador) {
        const changes: UpdateRecuperadorInput = {
          ...input,
          documentos: adjuntos,
          // La foto solo se envía si cambió (omitirla la conserva en el servidor).
          ...(v.foto !== (recuperador.foto ?? '') ? { foto } : {}),
        }
        const updated = await recuperadoresService.update(recuperador.id_recuperador, changes)
        toast.success(`Recuperador ${updated.nombre} ${updated.apellido} actualizado.`)
        onSaved(updated, 'updated')
      } else {
        const created = await recuperadoresService.create({ ...input, foto, documentos: adjuntos })
        toast.success(`Recuperador ${created.nombre} ${created.apellido} registrado. Se generó su carnet.`)
        reset(emptyValues())
        setDocumentos([])
        setPaso(0)
        onSaved(created, 'created')
      }
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        const message = getErrorMessage(error, '')
        if (message.includes('código')) {
          setPaso(0)
          setError('codigo_registro', { message: 'Este código de registro ya existe' })
        } else {
          setPaso(1)
          setError('cedula', { message: 'Ya existe un recuperador con este número de documento' })
        }
      }
      toast.error(getErrorMessage(error, editing ? 'No se pudo actualizar el recuperador' : 'No se pudo registrar el recuperador'))
    }
  }

  const onInvalid = (invalid: FieldErrors<RecuperadorValues>) => {
    toast.error('Revisa los campos marcados en el formulario.')
    const campos = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[id]') ?? [])
    const campo = campos.find((element) => Object.hasOwn(invalid, element.id))
    const panel = campo?.closest<HTMLElement>('[data-form-step]')
    if (panel) {
      setPaso(Number(panel.dataset.formStep))
      requestAnimationFrame(() => {
        const control = campo?.matches('input, button, select, textarea') ? campo : campo?.querySelector<HTMLElement>('input, button, select, textarea')
        const destino = control ?? panel
        destino.focus()
        panel.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    }
  }
  const message = (name: keyof RecuperadorValues) => errors[name]?.message as string | undefined

  const textRow = (
    name: TextField,
    label: string,
    options: { description?: string; required?: boolean; type?: string; inputMode?: 'numeric' | 'tel'; max?: string } = {},
  ) => (
    <FormRow id={name} htmlFor={name} label={label} description={options.description} error={message(name)} required={options.required}>
      <Input
        id={name}
        type={options.type}
        inputMode={options.inputMode}
        max={options.max}
        autoComplete="off"
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(name, message(name))}
        {...register(name)}
      />
    </FormRow>
  )

  const selectRow = (
    name: TextField,
    label: string,
    items: readonly string[],
    options: { description?: string; required?: boolean; labels?: Record<string, string> } = {},
  ) => (
    <FormRow id={name} htmlFor={name} label={label} description={options.description} error={message(name)} required={options.required}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={(value) => field.onChange(value === NONE ? '' : value)}>
            <SelectTrigger
              id={name}
              ref={field.ref}
              onBlur={field.onBlur}
              aria-invalid={!!errors[name]}
              aria-describedby={describedBy(name, message(name))}
            >
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              {!options.required && <SelectItem value={NONE}>Sin especificar</SelectItem>}
              {items.map((item) => (
                <SelectItem key={item} value={item}>
                  {options.labels?.[item] ?? item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FormRow>
  )

  const switchRow = (name: BooleanField, label: string, description?: string) => (
    <FormRow id={name} htmlFor={name} label={label} description={description}>
      <SwitchControl control={control} name={name} id={name} />
    </FormRow>
  )

  const checkboxRow = (name: ListField, label: string, items: readonly string[], description?: string) => (
    <FormRow id={name} label={label} description={description} error={message(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => <CheckboxGroup options={items} value={field.value} onChange={field.onChange} labelledBy={`${name}-label`} />}
      />
    </FormRow>
  )

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <QueryState
        loading={estados.loading}
        error={estados.error}
        isEmpty={false}
        onRetry={() => void estados.reload()}
        emptyTitle=""
        rows={4}
      >
        <form ref={formRef} onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate aria-label={editing ? 'Editar recuperador' : 'Nuevo recuperador'}>
          <nav aria-label="Secciones de caracterización" className="mb-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
            <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
              {PASOS.map((nombre, index) => (
                <li key={nombre} className="relative min-w-0">
                  {index < PASOS.length - 1 && <span aria-hidden="true" className={`absolute top-4 left-1/2 hidden h-0.5 w-full sm:block ${index < paso ? 'bg-primary' : 'bg-border'}`} />}
                  <button
                    type="button"
                    aria-current={paso === index ? 'step' : undefined}
                    disabled={isSubmitting || leyendoDocumentos}
                    onClick={() => setPaso(index)}
                    className={`relative flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg px-1 text-center text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${paso === index ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <span className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${paso === index ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15' : index < paso ? 'border-primary bg-card text-primary' : 'border-border bg-card'}`}>{index + 1}</span>
                    <span className="break-words">{nombre}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <p className="mb-4 text-sm text-muted-foreground">Paso {paso + 1} de {PASOS.length}. Puedes cambiar de sección sin perder lo diligenciado; se guarda al enviar el formulario.</p>
          <div className="[&_section>div]:grid [&_section>div]:gap-x-6 [&_section>div]:divide-y-0 [&_section>div]:lg:grid-cols-2 [&_section>div>div]:md:grid-cols-1 [&_section>div>div]:md:gap-2">
          <div data-form-step="0" hidden={paso !== 0} tabIndex={-1}>
          <FormSection title="1. Información general del registro">
            {textRow('fecha_inscripcion', 'Fecha de inscripción', { type: 'date', max: todayISO(), required: true })}
            {textRow('lugar', 'Lugar', { description: 'Municipio y departamento' })}
            {textRow('codigo_registro', 'Código único de registro', { description: 'ID asignado al registro (opcional)' })}
            <FormRow id="id_estado" htmlFor="id_estado" label="Estado" description="Solo los activos registran ventas" error={message('id_estado')} required>
              <Controller
                control={control}
                name="id_estado"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="id_estado"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.id_estado}
                      aria-describedby={describedBy('id_estado', message('id_estado'))}
                    >
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estados.data?.map((e) => (
                        <SelectItem key={e.id_estado} value={String(e.id_estado)}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormRow>
            {switchRow('pertenece_organizacion', 'Organización de recicladores', '¿Pertenece a una asociación, cooperativa, etc.?')}
            {pertenece && textRow('organizacion_nombre', 'Nombre de la organización', { required: true })}
            {pertenece && textRow('organizacion_nit', 'NIT de la organización')}
          </FormSection>
          </div>
          <div data-form-step="1" hidden={paso !== 1} tabIndex={-1}>
          <FormSection title="2. Datos de identificación del reciclador de oficio">
            <FormRow id="foto" label="Foto" description="Imagen para el carnet" error={message('foto')} required>
              <Controller
                control={control}
                name="foto"
                render={({ field }) => (
                  <CameraCapture
                    value={field.value || null}
                    onChange={(photo) => field.onChange(photo ?? '')}
                    invalid={!!errors.foto}
                    describedBy={errors.foto ? 'foto-error' : 'foto-label'}
                  />
                )}
              />
            </FormRow>
            {textRow('nombre', 'Nombres', { description: 'Nombres del recuperador', required: true })}
            {textRow('apellido', 'Apellidos', { description: 'Apellidos del recuperador', required: true })}
            {selectRow('tipo_documento', 'Tipo de documento', TIPOS_DOCUMENTO, { required: true, labels: TIPOS_DOCUMENTO_AYUDA })}
            {tipoDocumento === 'Otro' && textRow('tipo_documento_otro', 'Especifica el tipo', { required: true })}
            {textRow('cedula', 'Número de documento', { description: 'Solo números, sin puntos', inputMode: 'numeric', required: true })}
            <FormRow
              id="fecha_nacimiento"
              htmlFor="fecha_nacimiento"
              label="Fecha de nacimiento"
              description={edad === null ? 'La edad se calcula automáticamente' : `Edad: ${edad} años`}
              error={message('fecha_nacimiento')}
            >
              <Input
                id="fecha_nacimiento"
                type="date"
                max={todayISO()}
                aria-invalid={!!errors.fecha_nacimiento}
                aria-describedby={describedBy('fecha_nacimiento', message('fecha_nacimiento'))}
                {...register('fecha_nacimiento')}
              />
            </FormRow>
            {selectRow('genero', 'Género', GENEROS)}
            {selectRow('rh', 'Grupo sanguíneo / RH', GRUPOS_RH)}
            {textRow('direccion', 'Dirección de residencia', { description: 'Dirección actual' })}
            {textRow('barrio', 'Barrio', { description: 'Barrio o vereda' })}
            {textRow('comuna', 'Comuna', { description: 'Comuna o localidad' })}
            {selectRow('estrato', 'Estrato socioeconómico', ESTRATOS)}
            {textRow('telefono', 'Teléfono / Celular', { description: 'Contacto', type: 'tel', inputMode: 'tel' })}
          </FormSection>
          </div>
          <div data-form-step="2" hidden={paso !== 2} tabIndex={-1}>
          <FormSection title="3. Caracterización socioeconómica y enfoque diferencial">
            {selectRow('estado_civil', 'Estado civil', ESTADOS_CIVILES)}
            {selectRow('nivel_educativo', 'Nivel educativo', NIVELES_EDUCATIVOS, { description: 'Máximo nivel alcanzado' })}
            {selectRow('pertenencia_etnica', 'Pertenencia étnica', PERTENENCIAS_ETNICAS)}
            {switchRow('discapacidad', 'Condición de discapacidad')}
            {discapacidad && textRow('discapacidad_tipo', 'Tipo de discapacidad', { required: true })}
            {switchRow('victima_conflicto', 'Víctima del conflicto armado', 'Población víctima del conflicto armado')}
            {victima && switchRow('ruv', 'Registro RUV', '¿Cuenta con registro en el RUV?')}
            {selectRow('salud', 'Afiliación a salud', AFILIACIONES_SALUD, { description: 'Sistema General de Seguridad Social en Salud' })}
            {switchRow('bancarizado', 'Bancarizado', '¿Tiene cuenta bancaria?')}
            <FormRow
              id="dependientes"
              label="Núcleo familiar"
              description="Personas a cargo"
              error={DEPENDIENTES.map(([name]) => message(name)).find(Boolean)}
            >
              <div className="grid grid-cols-2 gap-3">
                {DEPENDIENTES.map(([name, label]) => (
                  <div key={name} className="grid gap-1">
                    <Label htmlFor={name} className="text-xs">
                      {label}
                    </Label>
                    <Input id={name} type="number" min={0} max={99} inputMode="numeric" aria-invalid={!!errors[name]} {...register(name)} />
                  </div>
                ))}
              </div>
            </FormRow>
          </FormSection>
          </div>
          <div data-form-step="3" hidden={paso !== 3} tabIndex={-1}>
          <FormSection title="4. Caracterización de la actividad de aprovechamiento">
            {textRow('experiencia_anios', 'Experiencia (años)', { description: 'Tiempo en la actividad', type: 'number', inputMode: 'numeric' })}
            {selectRow('jornada', 'Jornada habitual', JORNADAS)}
            {selectRow('lugar_recoleccion', 'Lugar principal', LUGARES_RECOLECCION, { description: 'Donde realiza la recolección y separación' })}
            {textRow('microruta', 'MicroRuta', { description: 'Nombre o código de la microruta' })}
            {textRow('microruta_direccion_inicial', 'Dirección inicial', { description: 'Donde inicia la microruta' })}
            {textRow('microruta_direccion_final', 'Dirección final', { description: 'Donde termina la microruta' })}
            {checkboxRow('transporte', 'Medios de transporte y herramientas', TRANSPORTES, 'Selecciona todas las que use')}
            {transporte.includes('Otro') && textRow('transporte_otro', 'Otro medio de transporte', { required: true })}
            {textRow('placa_habitual', 'Placa habitual (opcional)', { description: 'Solo si el vehículo tiene placa. No completa la placa de ingresos históricos.' })}
            {selectRow('epp', 'Uso de elementos de protección (EPP)', USOS_EPP, { description: 'Guantes, botas, tapabocas, overol' })}
            {checkboxRow('materiales', 'Materiales principalmente recuperados', MATERIALES_RECUPERADOS, 'Selecciona todos los que recupere')}
            {materiales.includes('Otros') && textRow('materiales_otros', 'Otros materiales', { required: true })}
          </FormSection>
          </div>
          </div>
          <div data-form-step="4" hidden={paso !== 4} tabIndex={-1}>
          <DocumentosRecuperador archivos={documentos} onChange={setDocumentos} recuperadorId={recuperador?.id_recuperador} disabled={isSubmitting} onBusyChange={setLeyendoDocumentos} />
          </div>
          <div data-form-step="5" hidden={paso !== 5} tabIndex={-1}>
          <FormSection title="6. Observaciones, declaración y autorización">
            <FormRow id="autoriza_datos" label="Declaración y autorización" error={message('autoriza_datos')} required={!editing}>
              <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                El(la) ciudadano(a) inscrito(a) declara bajo gravedad de juramento que la información aquí suministrada es verídica. Asimismo, autoriza de
                manera previa, expresa e informada a la organización de recicladores, al municipio y a las entidades competentes para el tratamiento de sus
                datos personales conforme a la Ley 1581 de 2012, con el propósito exclusivo de su caracterización, inclusión social y formalización en el
                marco de la prestación del servicio público de aseo en Colombia.
              </p>
              <label htmlFor="autoriza_datos" className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  id="autoriza_datos"
                  type="checkbox"
                  aria-invalid={!!errors.autoriza_datos}
                  aria-describedby={describedBy('autoriza_datos', message('autoriza_datos'))}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                  {...register('autoriza_datos')}
                />
                Declaro que la información es verídica y autorizo el tratamiento de mis datos personales.
              </label>
            </FormRow>
          </FormSection>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-dashed pt-4">
            <Button type="button" variant="outline" disabled={paso === 0 || isSubmitting || leyendoDocumentos} onClick={() => setPaso((actual) => actual - 1)}>Anterior</Button>
            {paso < PASOS.length - 1 && <Button type="button" variant="outline" disabled={isSubmitting || leyendoDocumentos} onClick={() => setPaso((actual) => actual + 1)}>Siguiente</Button>}
            {editing && onCancel && (
              <Button type="button" variant="outline" disabled={isSubmitting || leyendoDocumentos} onClick={onCancel}>
                <X /> Cancelar
              </Button>
            )}
            {isValid && <Button type="submit" disabled={isSubmitting || leyendoDocumentos}>
              <Save /> {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar y generar carnet'}
            </Button>}
          </div>
          {!isValid && <p className="mt-3 text-right text-xs text-muted-foreground">Completa los campos obligatorios (*) y corrige los errores para mostrar el botón de guardar.</p>}
        </form>
      </QueryState>
    </GradientFrame>
  )
}
