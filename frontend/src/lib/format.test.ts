import { formatCOP, formatDate, formatKg, fullName, initials, todayISO } from './format'

describe('format', () => {
  it('formatCOP usa separador de miles y sin decimales', () => {
    expect(formatCOP(15625)).toBe('$ 15.625')
    expect(formatCOP(0)).toBe('$ 0')
  })

  it('formatKg admite decimales', () => {
    expect(formatKg(12.5)).toBe('12,5 kg')
  })

  it('formatDate no depende de la zona horaria', () => {
    expect(formatDate('2026-10-14')).toBe('14/10/2026')
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })

  it('todayISO usa la fecha local', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('initials y fullName toleran datos vacíos', () => {
    expect(initials('María', 'López Rojas')).toBe('ML')
    expect(initials('', '')).toBe('?')
    expect(fullName('Juan', null)).toBe('Juan')
  })
})
