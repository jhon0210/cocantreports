import { formatDateOnly, parseDateOnly, todayInTimezone } from './date.util';

describe('date.util', () => {
  it('parseDateOnly acepta fechas reales y rechaza inexistentes o mal formadas', () => {
    expect(formatDateOnly(parseDateOnly('2026-02-28')!)).toBe('2026-02-28');
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('2026-13-01')).toBeNull();
    expect(parseDateOnly('14/10/2026')).toBeNull();
  });

  it('todayInTimezone usa la fecha local de la zona, no la de UTC', () => {
    // 2026-10-15 02:30 UTC sigue siendo 14 de octubre en Bogotá (UTC-5)
    const instante = new Date('2026-10-15T02:30:00Z');
    expect(formatDateOnly(todayInTimezone('America/Bogota', instante))).toBe('2026-10-14');
    expect(formatDateOnly(todayInTimezone('UTC', instante))).toBe('2026-10-15');
  });
});
