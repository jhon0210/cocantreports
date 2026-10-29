/** Utilidades para fechas "solo día" (columnas DATE) sin corrimientos por zona horaria. */

/** Devuelve la fecha de hoy en la zona horaria indicada, como Date en UTC a medianoche. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parseDateOnly(parts)!;
}

/** Convierte 'YYYY-MM-DD' en Date (UTC, medianoche). Devuelve null si el formato o la fecha no son válidos. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid ? date : null;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
