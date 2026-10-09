import './environment';

export const API_CONFIG = Symbol('API_CONFIG');
export type ApiRealm = 'client' | 'admin';

export interface ApiConfig {
  realm: ApiRealm;
  host: string;
  port: number;
  jwtSecret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  swaggerEnabled: boolean;
}

export function loadApiConfig(realm: ApiRealm): ApiConfig {
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
  const jwtSecret = process.env[`${prefix}_JWT_SECRET`] ?? `${realm}-secret`;
  if (!jwtSecret.trim())
    throw new Error(`${prefix}_JWT_SECRET must not be empty`);
  const otherSecret =
    process.env[realm === 'client' ? 'ADMIN_JWT_SECRET' : 'CLIENT_JWT_SECRET'];
  if (otherSecret === jwtSecret)
    throw new Error('Client and admin JWT secrets must differ');
  return {
    realm,
    host: process.env[`${prefix}_API_HOST`] ?? '0.0.0.0',
    port,
    jwtSecret,
    issuer: `starter:${realm}-api`,
    audience: `starter:${realm}`,
    accessTtlSeconds: 604800,
    swaggerEnabled: process.env[`${prefix}_SWAGGER_ENABLED`] !== 'false',
  };
}
