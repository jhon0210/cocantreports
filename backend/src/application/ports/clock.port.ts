export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
  /** Fecha de hoy (solo día) en la zona horaria de la aplicación, como Date UTC a medianoche. */
  today(): Date;
}
