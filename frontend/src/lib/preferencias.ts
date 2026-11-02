import { ESCALAS_PX, TEMAS, type Preferencias } from '@/stores/preferencias.store'

/** Refleja las preferencias en el documento: letra base, color del tema y estilo de campos. */
export function aplicarPreferencias(p: Preferencias, root: HTMLElement = document.documentElement): void {
  root.style.fontSize = `${ESCALAS_PX[p.escala]}px`
  root.style.setProperty('--tema-hue', String(TEMAS.find((t) => t.id === p.tema)?.hue ?? 160))
  root.dataset.campos = p.campos
  root.dataset.ripple = p.ripple ? 'on' : 'off'
  root.classList.toggle('dark', p.modo === 'oscuro')
  root.style.colorScheme = p.modo === 'oscuro' ? 'dark' : 'light'
}

/** Onda al pulsar un botón; solo actúa cuando el efecto está activado. */
export function crearRipple(event: PointerEvent): void {
  if (document.documentElement.dataset.ripple !== 'on' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const objetivo = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-slot="button"]') : null
  if (!objetivo || (objetivo as HTMLButtonElement).disabled) return
  if (getComputedStyle(objetivo).position === 'static') objetivo.style.position = 'relative'
  const caja = objetivo.getBoundingClientRect()
  const lado = Math.max(caja.width, caja.height)
  const onda = document.createElement('span')
  onda.className = 'efecto-ripple'
  onda.style.width = onda.style.height = `${lado}px`
  onda.style.left = `${event.clientX - caja.left - lado / 2}px`
  onda.style.top = `${event.clientY - caja.top - lado / 2}px`
  onda.addEventListener('animationend', () => onda.remove(), { once: true })
  objetivo.append(onda)
}
