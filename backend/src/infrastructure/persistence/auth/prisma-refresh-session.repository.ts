import { Injectable } from '@nestjs/common';
import { NewRefreshSession, RefreshSession } from '../../../domain/auth/refresh-session.entity';
import { RefreshSessionRepository } from '../../../domain/auth/refresh-session.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(s: NewRefreshSession): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { id: s.id, familia: s.familia, id_user: s.userId, token_hash: s.tokenHash, expires_at: s.expiresAt },
    });
  }

  async findById(id: string): Promise<RefreshSession | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      familia: row.familia,
      userId: row.id_user,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      replacedBy: row.replaced_by,
    };
  }

  rotate(currentId: string, next: NewRefreshSession, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Condicional: solo una petición concurrente puede revocar el token vigente.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: currentId, revoked_at: null },
        data: { revoked_at: now, replaced_by: next.id },
      });
      if (count !== 1) return false;
      await tx.refreshToken.create({
        data: { id: next.id, familia: next.familia, id_user: next.userId, token_hash: next.tokenHash, expires_at: next.expiresAt },
      });
      return true;
    });
  }

  async revokeFamily(familia: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familia, revoked_at: null }, data: { revoked_at: now } });
  }

  async revokeAllForUser(userId: number, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { id_user: userId, revoked_at: null }, data: { revoked_at: now } });
  }

  async deleteExpired(now: Date): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { expires_at: { lt: now } } });
  }
}
