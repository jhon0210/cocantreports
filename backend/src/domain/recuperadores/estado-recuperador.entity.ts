/**
 * Estados del recuperador. Los ids deben coincidir con las filas de `estados_recuperador`
 * (migración 20260101000200_estado_recuperador). El código depende de ellos para las reglas de negocio
 * (p. ej. solo un recuperador Activo puede registrar ventas); agregar un estado nuevo es una fila + una constante.
 */
export const EstadoRecuperadorId = {
  ACTIVO: 1,
  INACTIVO: 2,
  FALLECIDO: 3,
} as const;

export interface EstadoRecuperador {
  id: number;
  nombre: string;
}
