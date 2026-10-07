import './environment';

export const API_CONFIG = Symbol('API_CONFIG');
export type ApiRealm = 'client' | 'admin';

export interface ApiConfig {
  realm: ApiRealm;
  host: string;
  port: number;
  allowedOrigins: string[];
  jwtSecret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  sessionTtlSeconds: number;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  swaggerEnabled: boolean;
}

export function loadApiConfig(realm: ApiRealm): ApiConfig {
  const environment = process.env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const production = environment === 'production';
  const prefix = realm.toUpperCase();
  const integer = (name: string, fallback: number, max: number): number => {
    const value = Number(process.env[`${prefix}_${name}`] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new Error(
        `${prefix}_${name} must be an integer between 1 and ${max}`,
      );
    }
    return value;
  };
  const port = integer('API_PORT', realm === 'client' ? 3001 : 3002, 65535);
  const defaultOrigins =
    realm === 'client'
      ? 'http://localhost:3005,http://127.0.0.1:3005,http://localhost:3001,http://127.0.0.1:3001'
      : 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3002,http://127.0.0.1:3002';
  const allowedOrigins = [
    ...new Set(
      (
        process.env[`${prefix}_ALLOWED_ORIGINS`] ??
        (production ? '' : defaultOrigins)
      )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
  for (const origin of allowedOrigins) {
    let valid = false;
    try {
      const url = new URL(origin);
      valid =
        ['http:', 'https:'].includes(url.protocol) && url.origin === origin;
    } catch {
      // Сообщение не включает потенциально чувствительное значение окружения.
    }
    if (!valid) {
      throw new Error(
        `${prefix}_ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths or wildcards`,
      );
    }
  }
  const jwtSecret =
    process.env[`${prefix}_JWT_SECRET`] ??
    (production
      ? ''
      : `development-${realm}-secret-not-for-production-000000000000`);
  if (
    Buffer.byteLength(jwtSecret) < 32 ||
    (production && /development|replace|change.?me/i.test(jwtSecret))
  ) {
    throw new Error(
      `${prefix}_JWT_SECRET must be a strong independent secret of at least 32 bytes`,
    );
  }
  const otherSecret =
    process.env[realm === 'client' ? 'ADMIN_JWT_SECRET' : 'CLIENT_JWT_SECRET'];
  if (otherSecret === jwtSecret)
    throw new Error('Client and admin JWT secrets must differ');
  const cookieSecure =
    production || process.env[`${prefix}_COOKIE_SECURE`] === 'true';
  const sameSite = process.env[`${prefix}_COOKIE_SAME_SITE`] ?? 'lax';
  if (sameSite !== 'lax' && sameSite !== 'strict' && sameSite !== 'none') {
    throw new Error(`${prefix}_COOKIE_SAME_SITE must be lax, strict, or none`);
  }
  if (sameSite === 'none' && !cookieSecure)
    throw new Error('SameSite=None requires secure cookies');
  return {
    realm,
    host:
      process.env[`${prefix}_API_HOST`] ??
      (realm === 'admin' ? '127.0.0.1' : '0.0.0.0'),
    port,
    allowedOrigins,
    jwtSecret,
    issuer: `starter:${realm}-api`,
    audience: `starter:${realm}`,
    accessTtlSeconds: integer('ACCESS_TTL_SECONDS', 900, 3600),
    sessionTtlSeconds: integer(
      'SESSION_TTL_SECONDS',
      realm === 'client' ? 2592000 : 28800,
      7776000,
    ),
    cookieName: `${cookieSecure ? '__Host-' : ''}${realm}_refresh`,
    cookieSecure,
    cookieSameSite: sameSite,
    swaggerEnabled:
      process.env[`${prefix}_SWAGGER_ENABLED`] === 'true' ||
      (!production && process.env[`${prefix}_SWAGGER_ENABLED`] !== 'false'),
  };
}
