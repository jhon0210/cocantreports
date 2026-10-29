export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Datos de entrada inválidos a nivel de dominio (400). */
export class ValidationError extends DomainError {}

/** El recurso solicitado no existe (404). */
export class NotFoundError extends DomainError {}

/** Conflicto con el estado actual, p. ej. duplicados (409). */
export class ConflictError extends DomainError {}

/** Regla de negocio incumplida (422). */
export class BusinessRuleError extends DomainError {}

/** Credenciales o sesión inválidas (401). */
export class UnauthorizedError extends DomainError {}

/** Autenticado pero sin permiso para la acción (403). */
export class ForbiddenError extends DomainError {}
