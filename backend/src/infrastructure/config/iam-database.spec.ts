const token = jest.fn();
const adapter = jest.fn();
jest.mock('@aws-sdk/rds-signer', () => ({ Signer: jest.fn().mockImplementation(() => ({ getAuthToken: token })) }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn().mockImplementation((config: unknown) => adapter(config)) }));
import { iamAdapter, iamMigrationUrl } from './iam-database';

describe('conexion IAM Express', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, {
      DB_HOST: 'synthetic.cluster-example.us-east-1.rds.amazonaws.com',
      DB_USER: 'cocjant_api', DB_NAME: 'cocjant', AWS_REGION: 'us-east-1',
    });
  });
  afterEach(() => { process.env = { ...saved }; });

  it('firma cada conexion fisica y exige TLS verificable con pool acotado', async () => {
    iamAdapter();
    const config = adapter.mock.calls[0][0];
    token.mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    expect(await config.password()).toBe('token-1');
    expect(await config.password()).toBe('token-2');
    expect(token).toHaveBeenCalledTimes(2);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.max).toBe(1);
    expect(config.maxLifetimeSeconds).toBeLessThan(900);
  });

  it('prepara URL temporal de migracion con CA publica y TLS estricto', async () => {
    token.mockResolvedValue('host?X-Amz-Credential=a%2Fb&X-Amz-Signature=synthetic');
    const url = new URL(await iamMigrationUrl());
    expect(decodeURIComponent(url.password)).toBe('host?X-Amz-Credential=a%2Fb&X-Amz-Signature=synthetic');
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.searchParams.get('sslcert')).toBe('/var/task/gateway-root-bundle.pem');
  });

  it('rechaza endpoints arbitrarios antes de generar credenciales', () => {
    process.env.DB_HOST = 'untrusted.example.com';
    expect(() => iamAdapter()).toThrow('Configuracion IAM');
    expect(token).not.toHaveBeenCalled();
  });
});
