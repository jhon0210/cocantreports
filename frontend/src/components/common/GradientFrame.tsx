import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GradientFrameProps {
  children: ReactNode
  className?: string
  /** Clases del contenedor interno (relleno, etc.). */
  innerClassName?: string
}

/** Marco con borde degradado: acento verde arriba que se desvanece hacia abajo (el mismo del formulario de login). */
export function GradientFrame({ children, className, innerClassName }: GradientFrameProps) {
  return (
    <div className={cn('rounded-[1.75rem] bg-gradient-to-b from-primary via-primary/20 to-border p-0.5 shadow-sm', className)}>
      <div className={cn('rounded-[1.65rem] bg-card', innerClassName)}>{children}</div>
    </div>
  )
}
