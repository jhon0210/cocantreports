import type { ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

interface QueryStateProps {
  loading: boolean
  error: string | null
  isEmpty: boolean
  onRetry?: () => void
  emptyTitle: string
  emptyDescription?: string
  /** Filas de skeleton mientras carga. */
  rows?: number
  children: ReactNode
}

/** Estados estándar de una lista: cargando (Skeleton), error (Alert) y vacío (Empty). */
export function QueryState({ loading, error, isEmpty, onRetry, emptyTitle, emptyDescription, rows = 4, children }: QueryStateProps) {
  if (loading) {
    return (
      <div className="grid gap-2" role="status" aria-live="polite" aria-label="Cargando datos">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
        <span className="sr-only">Cargando…</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>No se pudo cargar la información</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2 text-foreground">
              <RefreshCw /> Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (isEmpty) {
    return (
      <Empty className="border py-5">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    )
  }

  return <>{children}</>
}
