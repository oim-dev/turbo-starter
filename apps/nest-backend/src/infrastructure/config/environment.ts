import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// pnpm запускает backend из apps/nest-backend. Локальные сервисы и API используют
// одинаковые значения infra/dev/.env; явное окружение и backend/.env приоритетнее.
if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(process.cwd(), '../../infra/dev/.env'), quiet: true });
}

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }
  const user = encodeURIComponent(process.env.POSTGRES_USER ?? 'starter');
  const password = encodeURIComponent(
    process.env.POSTGRES_PASSWORD ?? 'starter_dev_password',
  );
  const database = encodeURIComponent(process.env.POSTGRES_DB ?? 'starter');
  const port = process.env.POSTGRES_PORT ?? '5544';
  return `postgresql://${user}:${password}@localhost:${port}/${database}`;
}
