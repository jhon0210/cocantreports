import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Tamaño base de letra (px) de cada paso de la escala; el paso 2 conserva el diseño original. */
export const ESCALAS_PX = [12, 13, 14, 15, 16] as const
export const ESCALA_INICIAL = 2

export const TEMAS = [
  { id: 'verde', nombre: 'Verde', hue: 160 },
  { id: 'azul', nombre: 'Azul', hue: 250 },
  { id: 'violeta', nombre: 'Violeta', hue: 295 },
  { id: 'turquesa', nombre: 'Turquesa', hue: 195 },
  { id: 'naranja', nombre: 'Naranja', hue: 55 },
] as const

export type TemaId = (typeof TEMAS)[number]['id']
export type TipoMenu = 'static' | 'overlay'
export type EstiloCampos = 'outlined' | 'filled'
export type ModoColor = 'claro' | 'oscuro'

export interface Preferencias {
  escala: number
  menu: TipoMenu
  campos: EstiloCampos
  ripple: boolean
  tema: TemaId
  modo: ModoColor
}

export const PREFERENCIAS_INICIALES: Preferencias = {
  escala: ESCALA_INICIAL,
  menu: 'static',
  campos: 'outlined',
  ripple: false,
  tema: 'verde',
  modo: 'claro',
}

interface PreferenciasState extends Preferencias {
  establecer: <K extends keyof Preferencias>(clave: K, valor: Preferencias[K]) => void
  restablecer: () => void
}

/** Descarta valores guardados que ya no sean válidos para no romper la interfaz. */
export function sanearPreferencias(guardado: Partial<Preferencias> | undefined): Preferencias {
  const g = guardado ?? {}
  return {
    escala: Number.isInteger(g.escala) && g.escala! >= 0 && g.escala! < ESCALAS_PX.length ? g.escala! : ESCALA_INICIAL,
    menu: g.menu === 'overlay' ? 'overlay' : 'static',
    campos: g.campos === 'filled' ? 'filled' : 'outlined',
    ripple: g.ripple === true,
    tema: TEMAS.some((t) => t.id === g.tema) ? (g.tema as TemaId) : 'verde',
    modo: g.modo === 'oscuro' ? 'oscuro' : 'claro',
  }
}

export const usePreferenciasStore = create<PreferenciasState>()(
  persist(
    (set) => ({
      ...PREFERENCIAS_INICIALES,
      establecer: (clave, valor) => set({ [clave]: valor } as Pick<Preferencias, typeof clave>),
      restablecer: () => set({ ...PREFERENCIAS_INICIALES }),
    }),
    {
      name: 'cocjant-preferencias',
      version: 1,
      partialize: ({ escala, menu, campos, ripple, tema, modo }) => ({ escala, menu, campos, ripple, tema, modo }),
      merge: (guardado, actual) => ({ ...actual, ...sanearPreferencias(guardado as Partial<Preferencias>) }),
    },
  ),
)
