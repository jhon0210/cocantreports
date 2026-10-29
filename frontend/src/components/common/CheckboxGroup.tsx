import { useId } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxGroupProps {
  options: readonly string[]
  value: string[]
  onChange: (value: string[]) => void
  /** Id del elemento que rotula el grupo. */
  labelledBy: string
  className?: string
}

/** Grupo de casillas de selección múltiple en columnas compactas. */
export function CheckboxGroup({ options, value, onChange, labelledBy, className }: CheckboxGroupProps) {
  const base = useId()
  const toggle = (option: string, checked: boolean) =>
    onChange(checked ? options.filter((o) => value.includes(o) || o === option) : value.filter((o) => o !== option))

  return (
    <div role="group" aria-labelledby={labelledBy} className={cn('grid gap-x-4 gap-y-2 sm:grid-cols-2', className)}>
      {options.map((option, index) => {
        const id = `${base}-${index}`
        return (
          <label key={option} htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm leading-tight">
            <input
              id={id}
              type="checkbox"
              checked={value.includes(option)}
              onChange={(event) => toggle(option, event.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
            />
            {option}
          </label>
        )
      })}
    </div>
  )
}
