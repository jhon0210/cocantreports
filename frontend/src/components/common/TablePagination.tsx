import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TablePaginationProps {
  current: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function TablePagination({ current, totalPages, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginación" className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
      <p className="text-xs text-muted-foreground">
        Página {current} de {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-8" disabled={current === 1} onClick={() => onPageChange(1)} aria-label="Primera página">
          <ChevronsLeft />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-8" disabled={current === 1} onClick={() => onPageChange(current - 1)} aria-label="Página anterior">
          <ChevronLeft />
        </Button>
        {pageWindow(current, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === current ? 'default' : 'outline'}
              size="icon"
              className="size-8"
              onClick={() => onPageChange(p)}
              aria-label={`Página ${p}`}
              aria-current={p === current ? 'page' : undefined}
            >
              {p}
            </Button>
          ),
        )}
        <Button type="button" variant="outline" size="icon" className="size-8" disabled={current === totalPages} onClick={() => onPageChange(current + 1)} aria-label="Página siguiente">
          <ChevronRight />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-8" disabled={current === totalPages} onClick={() => onPageChange(totalPages)} aria-label="Última página">
          <ChevronsRight />
        </Button>
      </div>
    </nav>
  )
}

function pageWindow(current: number, total: number): Array<number | null> {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  const out: Array<number | null> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null)
    out.push(p)
  })
  return out
}
