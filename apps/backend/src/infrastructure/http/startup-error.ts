import type { ApiConfig } from '../config/api-config';
import { databaseUrl } from '../config/environment';

const knownCodes = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EADDRINUSE',
  'EACCES',
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1010',
  'P1011',
  'P1013',
  'P2010',
  'P2021',
  'P2022',
  '28P01',
  '3D000',
  '42P01',
  'INVALID_BOOTSTRAP_PASSWORD',
]);

function collectCodes(
  value: unknown,
  codes: Set<string>,
  visited: Set<object>,
  depth = 0,
): void {
  if (
    typeof value !== 'object' ||
    value === null ||
    visited.has(value) ||
    depth > 8
  )
    return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 20))
      collectCodes(child, codes, visited, depth + 1);
    return;
  }
  for (const key of ['code', 'errorCode']) {
    const code: unknown = Reflect.get(value, key);
    if (typeof code === 'string' && knownCodes.has(code)) codes.add(code);
  }
  // AggregateError.errors и Prisma driverAdapterError часто содержат настоящую причину.
  for (const key of ['cause', 'errors', 'meta', 'driverAdapterError']) {
    collectCodes(Reflect.get(value, key), codes, visited, depth + 1);
  }
}

export function describeStartupFailure(
  error: unknown,
  config: Pick<ApiConfig, 'realm' | 'port'>,
): string {
  const codes = new Set<string>();
  collectCodes(error, codes, new Set());
  let endpoint = '(invalid database configuration)';
  try {
    const url = new URL(databaseUrl());
    endpoint = `${url.hostname}:${url.port || '5432'}`;
  } catch {
    // Не печатаем исходную строку подключения, message/cause/stack: они могут содержать credentials.
  }
  let hint =
    'Check database connectivity, migrations and server configuration.';
  if (codes.has('ECONNREFUSED') || codes.has('P1001'))
    hint =
      'Check POSTGRES_HOST/POSTGRES_PORT and the published PostgreSQL port.';
  if (codes.has('P1000') || codes.has('28P01'))
    hint = 'Check the database credentials configured for this API.';
  if (codes.has('P2021') || codes.has('P2022') || codes.has('42P01'))
    hint = 'Apply the database migrations before starting the API.';
  if (codes.has('EADDRINUSE'))
    hint = `API port ${config.port} is already in use.`;
  if (codes.has('INVALID_BOOTSTRAP_PASSWORD'))
    hint =
      'BOOTSTRAP_ADMIN_PASSWORD must contain 12 to 128 characters, or use the initial admin default.';
  const realm = config.realm === 'admin' ? 'Admin' : 'Client';
  return `${realm} API startup failed [${[...codes].join(', ') || 'UNKNOWN'}]. PostgreSQL: ${endpoint}. ${hint}`;
}
