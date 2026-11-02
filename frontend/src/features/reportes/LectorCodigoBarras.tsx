import { useEffect, useRef, useState } from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'
import { recuperadoresService } from '@/services/recuperadores.service'
import type { Recuperador } from '@/types/api'

/** Un lector de código de barras "teclea" todos los caracteres en pocos milisegundos; una persona tarda mucho más. */
const MAX_MS_ENTRE_TECLAS = 100
const MIN_LONGITUD = 6
const MAX_LONGITUD = 40
/** Pausa tras la que se da por terminada una lectura si el lector no envía Enter. */
const FIN_LECTURA_MS = 150

interface LectorCodigoBarrasProps {
  onFound: (recuperador: Recuperador) => void
  onNotFound: () => void
}

/** Espera la lectura del carnet con un lector de código de barras y consulta al recuperador al leerlo; no admite escribir el código a mano. */
export function LectorCodigoBarras({ onFound, onNotFound }: LectorCodigoBarrasProps) {
  const [estado, setEstado] = useState<{ tipo: 'espera' | 'buscando' | 'error'; mensaje: string }>({
    tipo: 'espera',
    mensaje: 'Lector listo. Escanea el código de barras del carnet.',
  })
  const callbacks = useRef({ onFound, onNotFound })
  useEffect(() => {
    callbacks.current = { onFound, onNotFound }
  })

  useEffect(() => {
    let buffer = ''
    let ultima = 0
    let temporizador: ReturnType<typeof setTimeout> | undefined
    let buscando = false

    const consultar = async (codigo: string) => {
      if (buscando) return
      buscando = true
      setEstado({ tipo: 'buscando', mensaje: `Consultando ${codigo}…` })
      try {
        callbacks.current.onFound(await recuperadoresService.getByCodigo(codigo))
        setEstado({ tipo: 'espera', mensaje: 'Lectura correcta. Puedes escanear otro carnet.' })
      } catch (error) {
        callbacks.current.onNotFound()
        const noExiste = getErrorStatus(error) === 404
        setEstado({ tipo: 'error', mensaje: noExiste ? `No hay un recuperador con el código ${codigo}.` : 'No se pudo consultar el recuperador.' })
        toast.error(noExiste ? `No se encontró un recuperador con el código ${codigo}.` : getErrorMessage(error))
      } finally {
        buscando = false
      }
    }

    const terminarLectura = () => {
      clearTimeout(temporizador)
      const leido = buffer
      buffer = ''
      if (leido.length >= MIN_LONGITUD) void consultar(leido)
      else if (leido) setEstado({ tipo: 'error', mensaje: 'Lectura incompleta o escrita a mano. Usa el lector de código de barras.' })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const destino = event.target
      if (destino instanceof HTMLElement && (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Enter') {
        if (buffer) {
          event.preventDefault()
          terminarLectura()
        }
        return
      }
      if (event.key.length !== 1) return
      const ahora = performance.now()
      // Tecleo lento = persona escribiendo: se descarta lo acumulado y solo cuenta una ráfaga rápida.
      if (ahora - ultima > MAX_MS_ENTRE_TECLAS) buffer = ''
      ultima = ahora
      if (buffer.length < MAX_LONGITUD) buffer += event.key
      clearTimeout(temporizador)
      temporizador = setTimeout(terminarLectura, FIN_LECTURA_MS)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(temporizador)
    }
  }, [])

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-dashed px-4 py-5 ${estado.tipo === 'error' ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/40'}`}
      role="status"
      aria-live="polite"
      data-testid="lector-codigo-barras"
    >
      {estado.tipo === 'buscando' ? <Loader2 className="size-6 shrink-0 animate-spin text-primary" aria-hidden="true" /> : <ScanBarcode className="size-6 shrink-0 text-primary" aria-hidden="true" />}
      <div>
        <p className="text-sm font-medium">{estado.mensaje}</p>
        <p className="text-xs text-muted-foreground">Al leer el carnet se consulta al recuperador automáticamente.</p>
      </div>
    </div>
  )
}
