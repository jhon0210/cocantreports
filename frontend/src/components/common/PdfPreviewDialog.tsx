import { useEffect, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface PdfPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  filename: string
  blob: Blob | null
}

/** Vista previa del PDF generado, con acciones de descargar e imprimir. */
export function PdfPreviewDialog({ open, onOpenChange, title, description, filename, blob }: PdfPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    // La URL del blob se crea y revoca dentro del efecto para que sea segura con StrictMode.
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [blob])

  const print = () => {
    const frame = frameRef.current?.contentWindow
    if (frame) {
      frame.focus()
      frame.print()
    } else if (url) {
      window.open(url, '_blank', 'noopener')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? 'Revisa el documento y descárgalo o imprímelo.'}</DialogDescription>
        </DialogHeader>
        {url ? (
          <iframe ref={frameRef} src={url} title={title} className="h-[60vh] w-full rounded-md border bg-muted" />
        ) : (
          <div className="h-[60vh] animate-pulse rounded-md bg-muted" />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button type="button" variant="secondary" asChild disabled={!url}>
            <a href={url ?? undefined} download={filename}>
              <Download /> Descargar PDF
            </a>
          </Button>
          <Button type="button" onClick={print} disabled={!url}>
            <Printer /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
