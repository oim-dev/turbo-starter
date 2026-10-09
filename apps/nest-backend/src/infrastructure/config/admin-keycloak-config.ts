export interface EnabledAdminKeycloakConfig {
  enabled: true;
  issuer: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendCallbackUrl: string;
  version: number;
}
export type AdminKeycloakConfig =
  { enabled: false } | EnabledAdminKeycloakConfig;

export function validateOidcUrl(value: string, name: string): URL {
  const url = new URL(value);
  const localHttp =
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    value !== url.href ||
    /[%\\\s]/.test(value) ||
    value.length > 2048
  ) {
    throw new Error(
      `${name}: требуется canonical HTTPS URL без credentials, query и fragment; HTTP разрешён только для loopback.`,
    );
  }
  return url;
}

export function validateAdminKeycloakConfig(
  config: EnabledAdminKeycloakConfig,
): void {
  const issuer = validateOidcUrl(config.issuer, 'issuer');
  if (issuer.pathname.includes('/.well-known/') || config.issuer.length > 512)
    throw new Error('Нужен issuer realm, а не discovery URL.');
  const callback = validateOidcUrl(config.callbackUrl, 'callbackUrl');
  const frontend = validateOidcUrl(
    config.frontendCallbackUrl,
    'frontendCallbackUrl',
  );
  if (
    !callback.pathname.endsWith('/auth/keycloak/callback') ||
    frontend.pathname !== '/auth/keycloak/callback' ||
    callback.href === frontend.href ||
    callback.origin !== frontend.origin
  ) {
    throw new Error(
      'Callbacks должны иметь разные пути на одном origin, совместимом с cookies.',
    );
  }
  for (const value of [config.clientId, config.clientSecret]) {
    if (!value || value.trim() !== value || /\p{Cc}/u.test(value))
      throw new Error(
        'Client ID и secret обязательны и не должны содержать внешние пробелы или управляющие символы.',
      );
  }
}
