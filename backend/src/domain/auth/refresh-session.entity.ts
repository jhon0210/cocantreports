export interface RefreshSession {
  id: string;
  familia: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export type NewRefreshSession = Pick<RefreshSession, 'id' | 'familia' | 'userId' | 'tokenHash' | 'expiresAt'>;
