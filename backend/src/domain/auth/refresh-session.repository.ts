import { NewRefreshSession, RefreshSession } from './refresh-session.entity';

export const REFRESH_SESSION_REPOSITORY = Symbol('REFRESH_SESSION_REPOSITORY');

export interface RefreshSessionRepository {
  create(session: NewRefreshSession): Promise<void>;
  findById(id: string): Promise<RefreshSession | null>;
  /**
   * Rota atómicamente: revoca la sesión `currentId` (solo si sigue vigente) y registra la nueva.
   * Devuelve false si la sesión actual ya estaba revocada (carrera / reutilización).
   */
  rotate(currentId: string, next: NewRefreshSession, now: Date): Promise<boolean>;
  revokeFamily(familia: string, now: Date): Promise<void>;
  revokeAllForUser(userId: number, now: Date): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
