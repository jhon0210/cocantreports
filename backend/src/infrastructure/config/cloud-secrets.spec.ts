const send = jest.fn();
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({ send, destroy: jest.fn() })),
  GetSecretValueCommand: jest.fn().mockImplementation((value: unknown) => value),
}));
import { loadCloudSecrets } from './cloud-secrets';

describe('secretos cloud', () => {
  const saved = { ...process.env };
  const url = 'postgresql://synthetic:synthetic@db.internal/cocjant?sslmode=require&sslaccept=strict&sslcert=/var/task/rds-global-bundle.pem&connection_limit=1&pool_timeout=5';
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_SECRET_ARN = 'arn:synthetic';
    delete process.env.DATABASE_URL;
    delete process.env.MIGRATION_DATABASE_URL;
    delete process.env.JWT_ACCESS_SECRET;
  });
  afterEach(() => { process.env = { ...saved }; });

  it('no consulta AWS en desarrollo local', async () => {
    delete process.env.APP_SECRET_ARN;
    await loadCloudSecrets();
    expect(send).not.toHaveBeenCalled();
  });
  it('carga solo las claves de API antes del bootstrap', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify({ DATABASE_URL: url, JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), NODE_ENV: 'unsafe' }) });
    await loadCloudSecrets();
    expect(process.env.DATABASE_URL).toBe(url);
    expect(process.env.JWT_ACCESS_SECRET).toBe('a'.repeat(32));
    expect(process.env.NODE_ENV).not.toBe('unsafe');
  });
  it('el ejecutor carga su conexion separada sin requerir JWT', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify({ MIGRATION_DATABASE_URL: url }) });
    await loadCloudSecrets(true);
    expect(process.env.MIGRATION_DATABASE_URL).toBe(url);
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
  it('IAM carga JWT sin guardar un token temporal de BD en Secrets Manager', async () => {
    Object.assign(process.env, {
      DB_AUTH_MODE: 'iam', DB_HOST: 'synthetic.cluster-example.us-east-1.rds.amazonaws.com',
      DB_USER: 'cocjant_api', DB_NAME: 'cocjant', AWS_REGION: 'us-east-1',
    });
    send.mockResolvedValue({ SecretString: JSON.stringify({ JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) }) });
    await loadCloudSecrets();
    expect(new URL(process.env.DATABASE_URL!).password).toBe('');
    expect(process.env.JWT_ACCESS_SECRET).toBe('a'.repeat(32));
  });
  it.each([
    '{}', 'null', 'secret-not-json',
    JSON.stringify({ DATABASE_URL: url.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs'), JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b' }),
  ])('rechaza secretos invalidos sin filtrar contenido', async (SecretString) => {
    send.mockResolvedValue({ SecretString });
    await expect(loadCloudSecrets()).rejects.toThrow('No se pudieron cargar o validar los secretos del entorno');
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
  it('sanea fallos SDK sin registrar secretos', async () => {
    send.mockRejectedValue(new Error('synthetic-sensitive-error'));
    await expect(loadCloudSecrets()).rejects.toThrow('No se pudieron cargar o validar los secretos del entorno');
  });
});
