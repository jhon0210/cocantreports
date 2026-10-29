export const RoleName = {
  ADMINISTRADOR: 'Administrador',
  COORDINADOR: 'Coordinador',
  OPERARIO: 'Operario',
  ADMINISTRADOR_ECA: 'Administrador Eca',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export const ALL_ROLES: readonly RoleName[] = [
  RoleName.ADMINISTRADOR,
  RoleName.COORDINADOR,
  RoleName.OPERARIO,
  RoleName.ADMINISTRADOR_ECA,
];
