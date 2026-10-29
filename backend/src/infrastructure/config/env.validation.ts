import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).invalid(Joi.ref('JWT_ACCESS_SECRET')).required().messages({
    'any.invalid': 'JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: Joi.number().integer().min(1).max(90).default(7),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: Joi.string().valid('strict', 'lax', 'none').default('strict'),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_PATH: Joi.string().valid('/auth', '/api/auth').default('/auth'),
  APP_TIMEZONE: Joi.string().default('America/Bogota'),
  FILE_STORAGE: Joi.string().valid('bd', 's3').default('bd'),
  S3_FILES_BUCKET: Joi.when('FILE_STORAGE', { is: 's3', then: Joi.string().required(), otherwise: Joi.string().optional() }),
  S3_ENDPOINT: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
}).custom((env, helpers) => {
  if (env.S3_ENDPOINT && env.NODE_ENV === 'production') {
    return helpers.error('any.custom', { message: 'S3_ENDPOINT solo se permite para pruebas locales' });
  }
  if (env.COOKIE_SAMESITE === 'none' && String(env.COOKIE_SECURE) !== 'true') {
    return helpers.error('any.custom', { message: 'COOKIE_SAMESITE=none requiere COOKIE_SECURE=true' });
  }
  return env;
}, 'cookie consistency');
