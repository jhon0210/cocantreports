import { Check, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  ESCALAS_PX,
  TEMAS,
  usePreferenciasStore,
  type EstiloCampos,
  type ModoColor,
  type TipoMenu,
} from '@/stores/preferencias.store'

function Opcion<T extends string>({ nombre, valor, actual, etiqueta, onChange }: {
  nombre: string
  valor: T
  actual: T
  etiqueta: string
  onChange: (valor: T) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" name={nombre} value={valor} checked={actual === valor} onChange={() => onChange(valor)} className="size-4 cursor-pointer accent-primary" />
      {etiqueta}
    </label>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  )
}

/** Configuración de diseño: escala, tipo de menú, estilo de campos, efecto ripple y color del tema. */
export function PanelConfiguracion({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { escala, menu, campos, ripple, tema, modo, establecer, restablecer } = usePreferenciasStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 gap-0 overflow-y-auto sm:max-w-xs">
        <SheetHeader>
          <SheetTitle>Configuración</SheetTitle>
          <SheetDescription>Personaliza el diseño. Se guarda en este navegador.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-6">
          <Grupo titulo="Apariencia">
            <div className="flex gap-5">
              <Opcion<ModoColor> nombre="modo-color" valor="claro" actual={modo} etiqueta="Claro" onChange={(v) => establecer('modo', v)} />
              <Opcion<ModoColor> nombre="modo-color" valor="oscuro" actual={modo} etiqueta="Oscuro (noche)" onChange={(v) => establecer('modo', v)} />
            </div>
          </Grupo>

          <Grupo titulo="Escala">
            <div className="flex items-center gap-2" role="group" aria-label="Escala del tamaño de letra">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Reducir escala" disabled={escala === 0} onClick={() => establecer('escala', escala - 1)}>
                <Minus />
              </Button>
              <div className="flex items-center gap-2">
                {ESCALAS_PX.map((px, i) => (
                  <button
                    key={px}
                    type="button"
                    aria-label={`Escala ${i + 1} de ${ESCALAS_PX.length} (${px} px)`}
                    aria-pressed={escala === i}
                    onClick={() => establecer('escala', i)}
                    className={cn('size-3.5 cursor-pointer rounded-full border transition-colors', escala === i ? 'border-primary bg-primary' : 'border-input bg-muted hover:bg-muted-foreground/30')}
                  />
                ))}
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Aumentar escala" disabled={escala === ESCALAS_PX.length - 1} onClick={() => establecer('escala', escala + 1)}>
                <Plus />
              </Button>
            </div>
          </Grupo>

          <Grupo titulo="Tipo de menú">
            <div className="flex gap-5">
              <Opcion<TipoMenu> nombre="tipo-menu" valor="static" actual={menu} etiqueta="Estático" onChange={(v) => establecer('menu', v)} />
              <Opcion<TipoMenu> nombre="tipo-menu" valor="overlay" actual={menu} etiqueta="Superpuesto" onChange={(v) => establecer('menu', v)} />
            </div>
          </Grupo>

          <Grupo titulo="Estilo de campos">
            <div className="flex gap-5">
              <Opcion<EstiloCampos> nombre="estilo-campos" valor="outlined" actual={campos} etiqueta="Con borde" onChange={(v) => establecer('campos', v)} />
              <Opcion<EstiloCampos> nombre="estilo-campos" valor="filled" actual={campos} etiqueta="Relleno" onChange={(v) => establecer('campos', v)} />
            </div>
          </Grupo>

          <Grupo titulo="Efecto ripple">
            <div className="flex items-center gap-2">
              <Switch id="config-ripple" checked={ripple} onCheckedChange={(v) => establecer('ripple', v)} aria-label="Efecto ripple" />
              <span className="text-sm text-muted-foreground" aria-hidden="true">{ripple ? 'Activado' : 'Desactivado'}</span>
            </div>
          </Grupo>

          <Grupo titulo="Color del tema">
            <div className="flex flex-wrap gap-3" role="group" aria-label="Color del tema">
              {TEMAS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.nombre}
                  aria-label={`Tema ${t.nombre}`}
                  aria-pressed={tema === t.id}
                  onClick={() => establecer('tema', t.id)}
                  style={{ backgroundColor: `oklch(0.48 0.11 ${t.hue})` }}
                  className={cn('flex size-9 cursor-pointer items-center justify-center rounded-lg text-white outline-offset-2 transition-transform hover:scale-105', tema === t.id && 'ring-2 ring-ring ring-offset-2')}
                >
                  {tema === t.id && <Check className="size-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </Grupo>

          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={restablecer}>
            <RotateCcw /> Restablecer diseño
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
