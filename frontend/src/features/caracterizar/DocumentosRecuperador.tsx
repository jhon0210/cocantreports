import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FormRow, FormSection } from '@/components/common/FormSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/errors'
import { recuperadoresService } from '@/services/recuperadores.service'
import { escanearDocumento } from '@/services/scanner.service'
import type { DocumentoRecuperador, DocumentoRecuperadorInput } from '@/types/api'

export type ArchivoRecuperador = DocumentoRecuperador | Exclude<DocumentoRecuperadorInput, { id: number }>
const TIPOS = [
  ['identificacion', 'Documento de identidad'],
  ['salud', 'Sisbén o EPS'],
  ['servicios', 'Cuenta de servicios'],
] as const

function leerArchivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el documento'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('El documento no se pudo procesar'))
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function DocumentosRecuperador({ archivos, onChange, recuperadorId, disabled, onBusyChange }: {
  archivos: ArchivoRecuperador[]
  onChange: (archivos: ArchivoRecuperador[]) => void
  recuperadorId?: number
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const [leyendo, setLeyendo] = useState(false)
  const [claveEscaner, setClaveEscaner] = useState('')
  const [escaneando, setEscaneando] = useState<string | null>(null)
  const reading = useRef(false)
  const seleccionar = async (tipo: string, file: File) => {
    if (reading.current) return
    reading.current = true
    setLeyendo(true)
    onBusyChange(true)
    try {
      if (file.size > 1024 * 1024 || !/\.(pdf|png|jpe?g)$/i.test(file.name) || file.name.length > 150) {
        throw new Error('Selecciona un PDF, PNG o JPEG de hasta 1 MB, con nombre de hasta 150 caracteres.')
      }
      const contenido = await leerArchivo(file)
      onChange([...archivos.filter((a) => a.tipo !== tipo), { tipo, nombre: file.name, contenido }])
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo adjuntar el documento'))
    } finally {
      reading.current = false
      setLeyendo(false)
      onBusyChange(false)
    }
  }
  const descargar = async (archivo: ArchivoRecuperador) => {
    if (!('id' in archivo) || !recuperadorId) return
    try {
      const blob = await recuperadoresService.documento(recuperadorId, archivo.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = archivo.nombre
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo descargar el documento'))
    }
  }
  const escanear = async (tipo: string) => {
    if (reading.current) return
    reading.current = true
    setLeyendo(true)
    setEscaneando(tipo)
    onBusyChange(true)
    try {
      const contenido = await escanearDocumento(claveEscaner.trim())
      onChange([...archivos.filter((a) => a.tipo !== tipo), {
        tipo, nombre: `${tipo}-escaneado.jpg`, contenido,
      }])
      toast.success('Documento escaneado y adjuntado. Guarda el formulario para conservarlo.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo escanear el documento'))
    } finally {
      reading.current = false
      setLeyendo(false)
      setEscaneando(null)
      onBusyChange(false)
    }
  }
  return (
    <FormSection title="Documentos escaneados" className="mt-6">
      <div className="grid gap-2 py-3 text-sm">
        <p className="text-muted-foreground">Escanea desde aquí con el conector WIA de Windows, o adjunta un archivo guardado. Un PDF, PNG o JPEG por tipo, máximo 1 MB cada uno.</p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Configurar escáner USB en este equipo</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>Instala el controlador WIA del fabricante para Windows 11 y conecta el escáner USB. Un controlador solo TWAIN no sirve para este conector.</li>
            <li>En Windows PowerShell, desde la carpeta del proyecto, ejecuta <code>powershell.exe -STA -File .\tools\scanner\Iniciar-Escaner.ps1</code>.</li>
            <li>Si Windows deniega el permiso de escucha, un administrador debe reservar solo esta dirección para tu usuario con <code>netsh http add urlacl url=http://localhost:17843/ user="DOMINIO\usuario"</code>, reemplazando el usuario por el resultado de <code>whoami</code>. Después ejecuta el conector sin permisos de administrador.</li>
            <li>El origen autorizado por defecto es http://localhost:5173. Si abres la aplicación con otra dirección, añade <code>-Origin "https://direccion-de-tu-aplicacion"</code> (sin barra final).</li>
            <li>Copia la clave temporal de la ventana del conector. Permite acceso a la red local si el navegador lo solicita. La clave solo se conserva mientras este formulario está abierto.</li>
            <li>Pulsa «Escanear», confirma el dispositivo y la adquisición en el diálogo de Windows. Se captura una página por tipo; para documentos multipágina, adjunta un PDF. Cierra el conector al terminar.</li>
          </ol>
        </details>
        <Label htmlFor="clave-escaner">Clave temporal del conector local</Label>
        <Input id="clave-escaner" type="password" autoComplete="off" value={claveEscaner} onChange={(e) => setClaveEscaner(e.target.value)} disabled={disabled || leyendo} placeholder="Pega la clave que muestra el conector WIA" />
        {escaneando && <p role="status">Escaneando… Completa o cancela el diálogo de Windows; puede estar detrás del navegador.</p>}
      </div>
      {TIPOS.map(([tipo, label]) => {
        const archivo = archivos.find((a) => a.tipo === tipo)
        return (
          <FormRow key={tipo} id={`documento-${tipo}`} htmlFor={`documento-${tipo}`} label={label}>
            <Button type="button" variant="outline" disabled={disabled || leyendo || !claveEscaner.trim()} onClick={() => void escanear(tipo)}>
              {escaneando === tipo ? 'Escaneando…' : 'Escanear con equipo USB'}
            </Button>
            <Input
              id={`documento-${tipo}`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={disabled || leyendo}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void seleccionar(tipo, file)
                event.target.value = ''
              }}
            />
            {archivo && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="break-all">{archivo.nombre}</span>
                {'id' in archivo && <Button type="button" variant="outline" disabled={disabled || leyendo} onClick={() => void descargar(archivo)}>Descargar</Button>}
                <Button type="button" variant="ghost" disabled={disabled || leyendo} onClick={() => onChange(archivos.filter((a) => a.tipo !== tipo))}>Quitar</Button>
              </div>
            )}
          </FormRow>
        )
      })}
    </FormSection>
  )
}
