export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AccessTokenPayload {
  sub: number;
  usuario: string;
  perfil: string;
}

export interface RefreshTokenClaims {
  sub: number;
  /** Identificador de la sesión (fila en refresh_tokens). */
  jti: string;
  /** Familia de rotación: todos los tokens derivados del mismo login. */
  fam: string;
}

export interface TokenService {
  readonly refreshTtlMs: number;
  signAccessToken(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }>;
  signRefreshToken(claims: RefreshTokenClaims, expiresAt: Date): Promise<string>;
  /** Verifica firma, tipo y (salvo `ignoreExpiration`) vigencia. Lanza UnauthorizedError si es inválido. */
  verifyRefreshToken(token: string, options?: { ignoreExpiration?: boolean }): Promise<RefreshTokenClaims>;
  /** Huella SHA-256 hex del token, para almacenarla en lugar del token. */
  fingerprint(token: string): string;
}
