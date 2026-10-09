import { config } from 'dotenv';
import { isIP } from 'node:net';
import { resolve } from 'node:path';

// Окружение процесса приоритетнее .env backend, затем infra/dev/.env.
config({
  path:
    process.env.DOTENV_CONFIG_PATH ?? [
      resolve(process.cwd(), '.env'),
      resolve(process.cwd(), '../../infra/dev/.env'),
    ],
  quiet: true,
});

function postgresValue(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function databaseUrl(): string {
  const host = postgresValue('POSTGRES_HOST', 'localhost');
  const ipv6 = isIP(host) === 6;
  if (!ipv6 && !/^[a-z0-9_.-]+$/i.test(host)) {
    throw new Error('POSTGRES_HOST must be a hostname or IP address');
  }
  const portValue = postgresValue('POSTGRES_PORT', '5544');
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || port < 1 || port > 65535) {
    throw new Error('POSTGRES_PORT must be an integer between 1 and 65535');
  }
  const user = encodeURIComponent(postgresValue('POSTGRES_USER', 'user'));
  const password = encodeURIComponent(
    postgresValue('POSTGRES_PASSWORD', 'password'),
  );
  const database = encodeURIComponent(postgresValue('POSTGRES_DB', 'default-db'));
  const hostname = ipv6 ? `[${host}]` : host;
  return `postgresql://${user}:${password}@${hostname}:${port}/${database}`;
}
