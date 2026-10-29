import { Transform } from 'class-transformer';

/** Elimina espacios al inicio/fin y colapsa espacios internos en cadenas. */
export function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));
}
