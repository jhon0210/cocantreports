import { memo, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, Container, CupSoda, Cylinder, Newspaper, Package, Recycle, Wine, Wrench } from 'lucide-react'
import { normalizeSearch } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Material } from '@/types/api'

interface Estilo {
  icon: LucideIcon
  color: string
}

const ESTILOS: Array<[RegExp, Estilo]> = [
  [/carton/, { icon: Package, color: 'from-amber-500 to-orange-600' }],
  [/papel|archivo/, { icon: Newspaper, color: 'from-sky-500 to-blue-600' }],
  [/\bpet\b|botella/, { icon: CupSoda, color: 'from-cyan-500 to-teal-600' }],
  [/vidrio/, { icon: Wine, color: 'from-emerald-500 to-green-700' }],
  [/chatarra|metal/, { icon: Wrench, color: 'from-slate-500 to-zinc-700' }],
  [/aluminio/, { icon: Cylinder, color: 'from-indigo-400 to-slate-600' }],
  [/plastico/, { icon: Container, color: 'from-fuchsia-500 to-purple-600' }],
]
const POR_DEFECTO: Estilo = { icon: Recycle, color: 'from-lime-500 to-green-600' }

function estiloMaterial(nombre: string | null): Estilo {
  const texto = normalizeSearch(nombre ?? '')
  return ESTILOS.find(([patron]) => patron.test(texto))?.[1] ?? POR_DEFECTO
}

interface MaterialCardsProps {
  id: string
  materiales: Material[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

/** Selector de material en tarjetas con icono, nombre y código. */
export const MaterialCards = memo(function MaterialCards({ id, materiales, value, onChange, disabled, invalid, describedBy }: MaterialCardsProps) {
  const opciones = useMemo(() => materiales.map((material) => ({
    material,
    estilo: estiloMaterial(material.nomMaterial),
  })), [materiales])
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Material vendido"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
    >
      {opciones.map(({ material: m, estilo: { icon: Icon, color } }) => {
        const selected = value === String(m.id_mat)
        return (
          <button
            key={m.id_mat}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(String(m.id_mat))}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-2 rounded-xl border-2 bg-card p-2 text-center transition-colors',
              'hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              'disabled:pointer-events-none disabled:opacity-50',
              selected ? 'border-primary bg-primary/5' : 'border-transparent ring-1 ring-border',
            )}
          >
            {selected && (
              <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                <Check className="size-3.5" />
              </span>
            )}
            <span className={cn('flex size-10 items-center justify-center rounded-full bg-gradient-to-br text-white', color)} aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <span className="text-xs leading-tight font-semibold break-words">{m.nomMaterial ?? `Material ${m.id_mat}`}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Código {m.codigo ?? '—'}</span>
          </button>
        )
      })}
    </div>
  )
})
