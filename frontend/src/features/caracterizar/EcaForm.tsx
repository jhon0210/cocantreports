import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download, FileText, Save, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { describedBy } from '@/components/common/Field'
import { FormRow, FormSection } from '@/components/common/FormSection'
import { GradientFrame } from '@/components/common/GradientFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/errors'
import { downloadEcaAdjunto, ecasService } from '@/services/ecas.service'
import type { Eca, EcaAdjuntoInput } from '@/types/api'
import { ecaSchema, type EcaValues } from './schemas'

const EMPTY: EcaValues = { nomEca: '', direccion: '', representante: '', codigo_nuec: '' }
const MAX_BYTES = 2 * 1024 * 1024
const MAX_FILES = 5

interface Archivo {
  key: string
  id?: number
  nombre: string
  tamano: number
  file?: File
}

function readPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}"`))
    reader.onabort = () => reject(new Error(`Se canceló la lectura de "${file.name}"`))
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.includes(',')) {
        reject(new Error(`No se pudo leer "${file.name}"`))
        return
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

interface EcaFormProps {
  eca?: Eca | null
  onSaved: (eca: Eca) => void
  onCancel?: () => void
}

const toValues = (eca: Eca): EcaValues => ({
  nomEca: eca.nomEca ?? '',
  direccion: eca.direccion ?? '',
  representante: eca.representante ?? '',
  codigo_nuec: eca.codigo_nuec ?? '',
})

export function EcaForm({ eca, onSaved, onCancel }: EcaFormProps) {
  const editing = !!eca
  const [archivos, setArchivos] = useState<Archivo[]>(() => (eca?.adjuntos ?? []).map((a) => ({ ...a, key: String(a.id) })))
  const [downloading, setDownloading] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EcaValues>({ resolver: zodResolver(ecaSchema), defaultValues: eca ? toValues(eca) : EMPTY })

  const onSubmit = async (values: EcaValues) => {
    try {
      const adjuntos: EcaAdjuntoInput[] = await Promise.all(archivos.map(async (a) => {
        if (a.id !== undefined) return { id: a.id }
        if (!a.file) throw new Error(`No se encuentra el archivo "${a.nombre}". Vuelve a seleccionarlo.`)
        return { nombre: a.nombre, contenido: await readPdf(a.file) }
      }))
      const input = { ...values, adjuntos }
      const saved = eca
        ? await ecasService.update(eca.id_eca, input)
        : await ecasService.create(input)
      toast.success(`ECA "${saved.nomEca}" ${editing ? 'actualizada' : 'registrada'} correctamente.`)
      if (!editing) {
        reset(EMPTY)
        setArchivos([])
      }
      onSaved(saved)
    } catch (error) {
      toast.error(getErrorMessage(error, editing ? 'No se pudo actualizar la ECA' : 'No se pudo registrar la ECA'))
    }
  }

  const addFiles = (files: FileList | null) => {
    if (isSubmitting) return
    if (!files?.length) return
    const selected = Array.from(files)
    if (archivos.length + selected.length > MAX_FILES) {
      toast.error('Puedes adjuntar hasta 5 archivos PDF por ECA.')
      return
    }
    const invalid = selected.find((f) => !/\.pdf$/i.test(f.name) || (f.type && f.type !== 'application/pdf') || f.size === 0 || f.size > MAX_BYTES || f.name.length > 150)
    if (invalid) {
      toast.error(`"${invalid.name}": selecciona un PDF de hasta 2 MB con un nombre de máximo 150 caracteres.`)
      return
    }
    setArchivos((prev) => [...prev, ...selected.map((file) => ({ key: crypto.randomUUID(), nombre: file.name, tamano: file.size, file }))])
  }

  const download = async (archivo: Archivo) => {
    if (!eca || archivo.id === undefined) return
    setDownloading(archivo.id)
    try {
      await downloadEcaAdjunto(eca.id_eca, { id: archivo.id, nombre: archivo.nombre })
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar el PDF'))
    } finally {
      setDownloading(null)
    }
  }

  const text = (name: keyof EcaValues, label: string, opts?: { required?: boolean; placeholder?: string; description?: string }) => (
    <FormRow id={name} htmlFor={name} label={label} error={errors[name]?.message} description={opts?.description} required={opts?.required}>
      <Input
        id={name}
        autoComplete="off"
        placeholder={opts?.placeholder}
        aria-invalid={!!errors[name]}
        aria-describedby={describedBy(name, errors[name]?.message)}
        {...register(name)}
      />
    </FormRow>
  )

  return (
    <GradientFrame innerClassName="px-6 py-5">
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={editing ? 'Editar ECA' : 'Nueva ECA'}>
        <div className="mb-5 border-b border-dashed pb-4 text-center">
          <h3 className="text-sm font-semibold">Cumplimiento Normativo de Bodegas de Reciclaje a Estaciones de Clasificación y Aprovechamiento</h3>
          <p className="mt-1 text-xs text-muted-foreground">Decreto 1381 de 2024 - Resolución 412 de 2026</p>
        </div>
        <fieldset disabled={isSubmitting} className="min-w-0">
          <FormSection title={editing ? 'Editar información de la organización / bodega' : 'Información de la organización / bodega'}>
            {text('nomEca', 'Nombre de la Organización / Bodega', { required: true })}
            {text('representante', 'Representante Legal / Responsable', { required: true })}
            {text('direccion', 'Dirección y Municipio / Ciudad', { required: true })}
            {text('codigo_nuec', 'Código NUEC / Registro SUI', { description: 'Si aplica (opcional)' })}
            <FormRow id="adjuntos" htmlFor="adjuntos" label="Adjuntar archivos PDF" description="Hasta 5 PDF de 2 MB cada uno. Los cambios se aplican al guardar la ECA.">
              <label
                htmlFor="adjuntos"
                className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring ${isSubmitting || archivos.length >= MAX_FILES ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary hover:bg-primary/5'} ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = isSubmitting || archivos.length >= MAX_FILES ? 'none' : 'copy'
                  if (!isSubmitting && archivos.length < MAX_FILES) setDragging(true)
                }}
                onDragLeave={(event) => {
                  if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  addFiles(event.dataTransfer.files)
                }}
              >
                <Upload aria-hidden="true" className="size-7 text-primary" />
                <span className="text-sm font-medium">{archivos.length >= MAX_FILES ? 'Límite de 5 documentos alcanzado' : 'Arrastra tus PDF aquí o haz clic para seleccionarlos'}</span>
                <span className="text-xs text-muted-foreground">Hasta 5 archivos · Máximo 2 MB por PDF · {archivos.length}/{MAX_FILES} adjuntos</span>
                <Input
                  id="adjuntos"
                  className="sr-only"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  disabled={isSubmitting || archivos.length >= MAX_FILES}
                  onChange={(event) => { addFiles(event.target.files); event.target.value = '' }}
                />
              </label>
              {archivos.length > 0 && (
                <ul className="mt-2 grid gap-2" aria-label="Archivos PDF adjuntos">
                  {archivos.map((a) => (
                    <li key={a.key} className="flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate" title={a.nombre}>{a.nombre}</p>
                        <p className="text-xs text-muted-foreground">{(a.tamano / 1024).toFixed(0)} KB · {a.id === undefined ? 'Pendiente de guardar' : 'Guardado'}</p>
                      </div>
                      {a.id !== undefined && (
                        <Button type="button" size="icon" variant="ghost" disabled={downloading !== null} onClick={() => void download(a)} aria-label={`Descargar ${a.nombre}`}><Download /></Button>
                      )}
                      <Button type="button" size="icon" variant="ghost" onClick={() => setArchivos((prev) => prev.filter((item) => item.key !== a.key))} aria-label={`Quitar ${a.nombre}`}><X /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </FormRow>
          </FormSection>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-dashed pt-4">
          {editing && onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              <X /> Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            <Save /> {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar ECA'}
          </Button>
        </div>
      </form>
    </GradientFrame>
  )
}
