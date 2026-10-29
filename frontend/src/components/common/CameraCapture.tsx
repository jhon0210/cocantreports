import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, Upload, User, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { fileToPhotoDataUrl, PHOTO_HEIGHT, PHOTO_WIDTH, toPhotoDataUrl } from '@/lib/image'
import { getErrorMessage } from '@/lib/errors'

interface CameraCaptureProps {
  value: string | null
  onChange: (photo: string | null) => void
  invalid?: boolean
  describedBy?: string
}

/** Toma una foto instantánea con la cámara (o permite subir un archivo si no hay cámara disponible). */
export function CameraCapture({ value, onChange, invalid, describedBy }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [live, setLive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLive(false)
  }, [])

  useEffect(() => stop, [stop])

  useEffect(() => {
    if (live && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => undefined)
    }
  }, [live])

  const start = async () => {
    setMessage(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Este navegador no permite usar la cámara (se requiere HTTPS o localhost). Puedes subir una imagen.')
      return
    }
    setStarting(true)
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      setLive(true)
    } catch (e) {
      const denied = e instanceof DOMException && e.name === 'NotAllowedError'
      setMessage(
        denied
          ? 'Permiso de cámara denegado. Habilítalo en el navegador o sube una imagen.'
          : 'No se detectó una cámara disponible. Puedes subir una imagen.',
      )
    } finally {
      setStarting(false)
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    onChange(toPhotoDataUrl(video, video.videoWidth, video.videoHeight))
    stop()
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    try {
      onChange(await fileToPhotoDataUrl(file))
    } catch (e) {
      setMessage(getErrorMessage(e, 'No se pudo procesar la imagen'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const linkBtn =
    'h-auto rounded-sm px-0 py-0 text-xs font-medium underline underline-offset-2 hover:opacity-80 disabled:no-underline'

  return (
    <div className="grid gap-3" aria-describedby={describedBy}>
      <div className="flex items-center gap-4">
        {live ? (
          <div
            className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg border bg-muted"
            style={{ maxWidth: PHOTO_WIDTH, maxHeight: PHOTO_HEIGHT }}
          >
            <video ref={videoRef} muted playsInline aria-label="Vista previa de la cámara" className="size-full -scale-x-100 object-cover" />
          </div>
        ) : (
          <div
            className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-card text-muted-foreground ${
              invalid ? 'border-destructive' : 'border-input'
            }`}
          >
            {value ? (
              <img src={value} alt="Foto del recuperador" className="size-full object-cover" />
            ) : (
              <User className="size-5" aria-hidden="true" />
            )}
          </div>
        )}

        <div className="grid gap-1.5">
          <p className="text-sm text-muted-foreground">
            {live ? 'Encuadra el rostro y toma la foto' : value ? 'Foto lista para el carnet' : 'Toma una foto o selecciona una imagen'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {live ? (
              <>
                <Button type="button" variant="link" className={linkBtn} onClick={capture}>
                  <Camera /> Tomar foto
                </Button>
                <Button type="button" variant="link" className={linkBtn} onClick={stop}>
                  <X /> Cancelar
                </Button>
              </>
            ) : value ? (
              <Button type="button" variant="link" className={linkBtn} onClick={() => onChange(null)}>
                <RefreshCw /> Repetir foto
              </Button>
            ) : (
              <>
                <Button type="button" variant="link" className={linkBtn} onClick={start} disabled={starting}>
                  <Camera /> {starting ? 'Abriendo cámara…' : 'Activar cámara'}
                </Button>
                <Button type="button" variant="link" className={linkBtn} onClick={() => fileRef.current?.click()}>
                  <Upload /> Subir imagen
                </Button>
              </>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Seleccionar imagen del recuperador"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
