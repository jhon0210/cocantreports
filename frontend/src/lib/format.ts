const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const integer = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const kg = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 })

/** Normaliza espacios especiales (NBSP) para que también se vean bien en PDFs. */
const plain = (s: string) => s.replace(/[\s\u00a0\u202f]/g, ' ')

export const formatCOP = (value: number): string => plain(cop.format(value))
export const formatInteger = (value: number): string => integer.format(value)
export const formatKg = (value: number): string => `${kg.format(value)} kg`

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita corrimientos de zona horaria). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Fecha local de hoy como 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function fullName(nombre?: string | null, apellido?: string | null): string {
  return [nombre, apellido].filter(Boolean).join(' ')
}

export const normalizeSearch = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function initials(nombre?: string | null, apellido?: string | null): string {
  const letters = `${nombre?.trim()[0] ?? ''}${apellido?.trim()[0] ?? ''}`.toUpperCase()
  return letters || '?'
}
