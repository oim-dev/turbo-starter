import { createHash, randomBytes } from 'node:crypto';

export const OIDC_TRANSACTION_TTL_MS = 5 * 60_000;
export const OIDC_COMPLETION_TTL_MS = 60_000;
export const OIDC_BROWSER_COOKIE_TTL_MS = 10 * 60_000;

export function randomOidcToken(): string {
  return randomBytes(32).toString('base64url');
}
export function hashOidcToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function isOidcToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

// Express уже декодировал внешний query-параметр returnTo один раз. Разбираем
// границы path/query/hash ДО дальнейшей проверки: данные query/hash не являются
// путём и не должны менять его смысл после decodeURIComponent всего значения.
export function safeAdminReturnTo(value: unknown = '/'): string {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\p{Cc}\p{Zl}\p{Zp}]/u.test(value)
  ) {
    throw new Error('Invalid return path');
  }

  const pathEnd = value.search(/[?#]/);
  const path = pathEnd === -1 ? value : value.slice(0, pathEnd);
  // Encoded separators не могут создавать новые сегменты/границы URL, а %25
  // запрещает повторное декодирование path. Malformed UTF-8/escape тоже запрещён.
  if (/%(?:2f|5c|3f|23|25)/i.test(path)) throw new Error('Invalid return path');
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    throw new Error('Invalid return path');
  }
  if (
    /[\s\\?#%\p{Cc}]/u.test(decodedPath) ||
    decodedPath
      .split('/')
      .some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid return path');
  }

  const origin = 'https://admin.invalid';
  const url = new URL(decodedPath, origin);
  if (
    url.origin !== origin ||
    !url.pathname.startsWith('/') ||
    url.pathname.startsWith('//')
  ) {
    throw new Error('Invalid return path');
  }
  // Проверяем нормализованный path, включая encoded имена и регистр. Query/hash
  // не должны обходить запрет возврата на API или создавать цикл входа.
  if (/^\/(?:api|auth\/keycloak|sign-in)(?:\/|$)/i.test(url.pathname)) {
    throw new Error('Invalid return path');
  }

  const hashStart = value.indexOf('#');
  const queryStart = value.indexOf('?');
  if (queryStart !== -1 && (hashStart === -1 || queryStart < hashStart)) {
    url.search = value.slice(
      queryStart,
      hashStart === -1 ? undefined : hashStart,
    );
  }
  if (hashStart !== -1) url.hash = value.slice(hashStart);

  // URL setters сохраняют существующее encoding query/hash и кодируют raw UTF-8
  // и пробелы; данные не декодируются повторно. href сохраняет даже пустые ?/#.
  const normalized = url.href.slice(origin.length);
  if (normalized.length > 2048) throw new Error('Invalid return path');
  return normalized;
}

export type KeycloakErrorCode =
  'keycloak_unavailable' | 'keycloak_denied' | 'keycloak_invalid';

export class AdminOidcError extends Error {
  constructor(readonly code: KeycloakErrorCode) {
    super(code);
  }
}
