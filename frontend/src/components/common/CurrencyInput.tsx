import { forwardRef, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const grouping = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

interface CurrencyInputProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number | undefined
  onValueChange: (value: number | undefined) => void
}

/** Campo de pesos colombianos: muestra separadores de miles (1.250) y entrega un número entero. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        $
      </span>
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('pl-7', className)}
        value={value === undefined || Number.isNaN(value) ? '' : grouping.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
          onValueChange(digits ? Number(digits) : undefined)
        }}
      />
    </div>
  )
})
