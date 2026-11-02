import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser, PenLine, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const WIDTH = 800
const HEIGHT = 300
/** Tope del backend para la firma (data URL). */
const MAX_LENGTH = 290_000

const ORIGEN: Record<string, string> = { pen: 'Lápiz de la tableta', touch: 'dedo (pantalla del equipo)', mouse: 'mouse' }

function exportarPng(canvas: HTMLCanvasElement): string {
  const completo = canvas.toDataURL('image/png')
  if (completo.length <= MAX_LENGTH) return completo
  const reducido = document.createElement('canvas')
  reducido.width = WIDTH / 2
  reducido.height = HEIGHT / 2
  reducido.getContext('2d')?.drawImage(canvas, 0, 0, reducido.width, reducido.height)
  return reducido.toDataURL('image/png')
}

/** Superficie de firma: recibe el lápiz de una tableta (con presión), el dedo o el mouse. */
function SuperficieFirma({ inicial, onListo, onCancelar }: { inicial: string; onListo: (png: string) => void; onCancelar: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const [conTinta, setConTinta] = useState(!!inicial)
  const [origen, setOrigen] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!inicial) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const imagen = new Image()
    imagen.onload = () => ctx.drawImage(imagen, 0, 0, WIDTH, HEIGHT)
    imagen.src = inicial
  }, [inicial])

  const punto = (event: PointerEvent<HTMLCanvasElement>) => {
    const caja = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - caja.left) * WIDTH) / caja.width, y: ((event.clientY - caja.top) * HEIGHT) / caja.height }
  }

  const trazar = (event: PointerEvent<HTMLCanvasElement>, desde: { x: number; y: number }, hasta: { x: number; y: number }) => {
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    // El lápiz informa presión real; con mouse o dedo se usa un grosor medio constante.
    const presion = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5
    ctx.lineWidth = 2 + presion * 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.beginPath()
    ctx.moveTo(desde.x, desde.y)
    ctx.lineTo(hasta.x, hasta.y)
    ctx.stroke()
  }

  const iniciar = (event: PointerEvent<HTMLCanvasElement>) => {
    // Solo firma el lápiz del dispositivo externo; el mouse y el dedo del equipo se ignoran.
    if (event.pointerType !== 'pen') {
      setAviso(`Se detectó ${ORIGEN[event.pointerType] ?? 'otro dispositivo'}. La firma se realiza únicamente con el lápiz de la tableta de firma conectada.`)
      return
    }
    setAviso(null)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setOrigen(ORIGEN.pen)
    const p = punto(event)
    ultimo.current = p
    trazar(event, p, { x: p.x + 0.01, y: p.y })
    setConTinta(true)
  }

  const mover = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!ultimo.current) return
    const p = punto(event)
    trazar(event, ultimo.current, p)
    ultimo.current = p
  }

  const terminar = () => {
    ultimo.current = null
  }

  const borrar = () => {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, WIDTH, HEIGHT)
    setConTinta(false)
  }

  const aceptar = () => {
    const canvas = canvasRef.current
    onListo(canvas && conTinta ? exportarPng(canvas) : '')
  }

  return (
    <>
      <div className="grid gap-2">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          role="img"
          aria-label="Área de firma"
          className="h-auto w-full touch-none cursor-crosshair rounded-md border-2 border-dashed bg-white"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {origen ? `Firmando con: ${origen}.` : 'Conecta la tableta de firma y firma con su lápiz dentro del recuadro.'}
        </p>
        {aviso && <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{aviso}</p>}
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="outline" onClick={borrar} disabled={!conTinta}><Eraser /> Borrar</Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={aceptar}>Aceptar</Button>
        </div>
      </DialogFooter>
    </>
  )
}

interface SignaturePadProps {
  id?: string
  /** PNG en data URL; vacío si no hay firma. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  describedBy?: string
}

/** Campo de firma digital: vista previa y ventana de captura con tableta de firma (Borrar, Cancelar, Aceptar). */
export function SignaturePad({ id, value, onChange, disabled, describedBy }: SignaturePadProps) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="grid gap-2">
      <div
        id={id}
        aria-describedby={describedBy}
        className="flex h-28 w-full max-w-md items-center justify-center overflow-hidden rounded-md border border-dashed bg-white"
      >
        {value ? <img src={value} alt="Firma digital registrada" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin firma</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAbierto(true)}>
          <PenLine /> {value ? 'Firmar de nuevo' : 'Firmar con tableta'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')}>
            <Trash2 /> Quitar firma
          </Button>
        )}
      </div>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Firma digital</DialogTitle>
            <DialogDescription>El recuperador firma con el lápiz de la tableta de firma conectada y confirma con Aceptar.</DialogDescription>
          </DialogHeader>
          <SuperficieFirma
            inicial={value}
            onCancelar={() => setAbierto(false)}
            onListo={(png) => {
              onChange(png)
              setAbierto(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
