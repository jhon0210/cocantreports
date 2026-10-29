import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Sección de formulario: título con línea inferior punteada y filas separadas por líneas punteadas. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="border-b border-dashed pb-2.5 text-sm font-semibold">{title}</h3>
      <div className="divide-y divide-dashed">{children}</div>
    </section>
  )
}

interface FormRowProps {
  /** Base de los ids de error/descripción (`${id}-error`, `${id}-label`). */
  id: string
  label: string
  description?: string
  /** Id del control a asociar con la etiqueta. Omitir si la fila contiene un control compuesto (p. ej. la foto). */
  htmlFor?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/** Fila "etiqueta + descripción a la izquierda, control a la derecha" (en móvil se apilan). */
export function FormRow({ id, label, description, htmlFor, error, required, className, children }: FormRowProps) {
  const text = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
      )}
    </>
  )

  return (
    <div className={cn('grid gap-2 py-3.5 md:grid-cols-[13rem_1fr] md:gap-6', className)}>
      <div>
        {htmlFor ? (
          <Label htmlFor={htmlFor}>{text}</Label>
        ) : (
          <span id={`${id}-label`} className="flex items-center gap-2 text-sm leading-none font-medium">
            {text}
          </span>
        )}
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid content-start gap-1.5">
        {children}
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
