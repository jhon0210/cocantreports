import { RefreshSession } from '../../../domain/auth/refresh-session.entity';
import { UnauthorizedError } from '../../../domain/shared/domain-errors';
import { Usuario } from '../../../domain/usuarios/usuario.entity';
import { TokenService } from '../../ports/token-service.port';
import { SessionService } from '../session.service';
import { REUSE_GRACE_MS, RefreshSessionUseCase } from './refresh-session.use-case';

const now = new Date('2026-10-14T12:00:00Z');
const user: Usuario = {
  id: 1, nombre: 'A', apellido: 'B', usuario: 'u', claveHash: 'h', cedula: 1, idPerfil: 3, perfil: 'Operario', idCargo: 1, cargo: 'c', idEca: null, eca: null, activo: true,
};

function build(stored: Partial<RefreshSession> | null, userOverride: Partial<Usuario> = {}) {
  const session: RefreshSession | null = stored && {
    id: 'jti-1', familia: 'fam-1', userId: 1, tokenHash: 'fp:tok', expiresAt: new Date(now.getTime() + 60_000),
    createdAt: now, revokedAt: null, replacedBy: null, ...stored,
  };
  const tokens: TokenService = {
    refreshTtlMs: 1000,
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(async (t: string) => {
      if (t !== 'tok') throw new UnauthorizedError('Sesión inválida');
      return { sub: 1, jti: 'jti-1', fam: 'fam-1' };
    }),
    fingerprint: (t: string) => `fp:${t}`,
  };
  const sesiones = {
    create: jest.fn(),
    findById: jest.fn(async () => session),
    rotate: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
    deleteExpired: jest.fn(),
  };
  const usuarios = { findById: jest.fn(async () => ({ ...user, ...userOverride })), findByUsuario: jest.fn(), findByCedula: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn() };
  const rotated = { accessToken: 'a', expiresIn: 900, refreshToken: 'r2', refreshExpiresAt: now, user };
  const sessionService = { open: jest.fn(), rotate: jest.fn(async () => rotated) } as unknown as SessionService;
  const useCase = new RefreshSessionUseCase(tokens, sesiones, usuarios, { now: () => now, today: () => now }, sessionService);
  return { useCase, sesiones, sessionService };
}

describe('RefreshSessionUseCase', () => {
  it('rota la sesión cuando el token es válido', async () => {
    const { useCase, sessionService } = build({});
    await expect(useCase.execute('tok')).resolves.toMatchObject({ refreshToken: 'r2' });
    expect(sessionService.rotate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'jti-1', 'fam-1');
  });

  it('rechaza si no hay token o la firma es inválida', async () => {
    const { useCase } = build({});
    await expect(useCase.execute(undefined)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(useCase.execute('otro')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rechaza si el hash guardado no coincide (token distinto aunque tenga el mismo jti)', async () => {
    const { useCase, sessionService } = build({ tokenHash: 'fp:distinto' });
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sessionService.rotate).not.toHaveBeenCalled();
  });

  it('rechaza si la sesión no existe', async () => {
    const { useCase } = build(null);
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('un token revocado recientemente se rechaza sin revocar la familia (carrera legítima)', async () => {
    const { useCase, sesiones } = build({ revokedAt: new Date(now.getTime() - (REUSE_GRACE_MS - 1000)) });
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sesiones.revokeFamily).not.toHaveBeenCalled();
  });

  it('la reutilización de un token revocado fuera de la ventana revoca la familia', async () => {
    const { useCase, sesiones } = build({ revokedAt: new Date(now.getTime() - REUSE_GRACE_MS - 1000) });
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sesiones.revokeFamily).toHaveBeenCalledWith('fam-1', now);
  });

  it('rechaza sesiones expiradas', async () => {
    const { useCase } = build({ expiresAt: new Date(now.getTime() - 1) });
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('si el usuario fue desactivado, revoca la familia y rechaza', async () => {
    const { useCase, sesiones } = build({}, { activo: false });
    await expect(useCase.execute('tok')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sesiones.revokeFamily).toHaveBeenCalled();
  });
});
