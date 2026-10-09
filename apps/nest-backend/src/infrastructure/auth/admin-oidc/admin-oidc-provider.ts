import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as oidc from 'openid-client';
import {
  type EnabledAdminKeycloakConfig,
  validateOidcUrl,
} from '../../config/admin-keycloak-config';
import { AdminOidcError } from './oidc-values';

// openid-client оборачивает ошибки customFetch в ClientError.cause.
// Сохраняем только собственный безопасный код, не сообщения/поля провайдера.
function transportFailure(error: unknown): AdminOidcError | undefined {
  for (let depth = 0; depth < 5 && error instanceof Error; depth++) {
    if (error instanceof AdminOidcError) return error;
    error = error.cause;
  }
  return undefined;
}

@Injectable()
export class AdminOidcProvider {
  private cached?: {
    version: number;
    expiresAt: number;
    promise: Promise<oidc.Configuration>;
  };

  async checkConfiguration(config: EnabledAdminKeycloakConfig): Promise<void> {
    try {
      await this.discover(config);
    } catch {
      throw new ServiceUnavailableException(
        'Не удалось проверить discovery Keycloak. Проверьте issuer и доступность провайдера.',
      );
    }
  }

  private async discover(
    config: EnabledAdminKeycloakConfig,
  ): Promise<oidc.Configuration> {
    const issuer = validateOidcUrl(config.issuer, 'issuer');
    const result = await oidc.discovery(
      issuer,
      config.clientId,
      {
        client_secret: config.clientSecret,
        id_token_signed_response_alg: 'RS256',
      },
      oidc.ClientSecretBasic(config.clientSecret),
      {
        timeout: 10,
        execute: [
          oidc.enableNonRepudiationChecks,
          ...(issuer.protocol === 'http:' ? [oidc.allowInsecureRequests] : []),
        ],
        [oidc.customFetch]: async (url, options) => {
          const target = new URL(url);
          if (
            target.origin !== issuer.origin ||
            target.username ||
            target.password ||
            target.hash
          ) {
            throw new AdminOidcError('keycloak_invalid');
          }
          let response: Response;
          const body =
            options.body instanceof Uint8Array
              ? new Uint8Array(options.body).buffer
              : options.body;
          try {
            response = await fetch(target, {
              ...options,
              body,
              redirect: 'error',
            });
          } catch {
            throw new AdminOidcError('keycloak_unavailable');
          }
          if (response.status >= 500 || response.status === 429) {
            await response.body?.cancel();
            throw new AdminOidcError('keycloak_unavailable');
          }
          return response;
        },
      },
    );
    const metadata = result.serverMetadata();
    if (metadata.issuer !== config.issuer)
      throw new AdminOidcError('keycloak_invalid');
    for (const endpoint of [
      metadata.authorization_endpoint,
      metadata.token_endpoint,
      metadata.jwks_uri,
    ]) {
      if (!endpoint) throw new AdminOidcError('keycloak_invalid');
      const url = validateOidcUrl(endpoint, 'Keycloak discovery endpoint');
      if (url.origin !== issuer.origin)
        throw new AdminOidcError('keycloak_invalid');
    }
    return result;
  }

  private async client(
    config: EnabledAdminKeycloakConfig,
  ): Promise<oidc.Configuration> {
    if (
      !this.cached ||
      this.cached.version !== config.version ||
      this.cached.expiresAt <= Date.now()
    ) {
      const pending = this.discover(config);
      this.cached = {
        version: config.version,
        expiresAt: Date.now() + 10 * 60_000,
        promise: pending,
      };
      void pending.catch(() => {
        if (this.cached?.promise === pending) this.cached = undefined;
      });
    }
    try {
      return await this.cached.promise;
    } catch (error) {
      const failure = transportFailure(error);
      if (failure) throw failure;
      throw new AdminOidcError('keycloak_unavailable');
    }
  }

  async authorizationUrl(
    config: EnabledAdminKeycloakConfig,
    input: {
      state: string;
      nonce: string;
      codeVerifier: string;
    },
  ): Promise<string> {
    return oidc.buildAuthorizationUrl(await this.client(config), {
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid',
      redirect_uri: config.callbackUrl,
      state: input.state,
      nonce: input.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(input.codeVerifier),
      code_challenge_method: 'S256',
    }).href;
  }

  async identity(
    config: EnabledAdminKeycloakConfig,
    url: URL,
    input: { state: string; nonce: string; codeVerifier: string },
  ): Promise<{ issuer: string; subject: string }> {
    try {
      const tokens = await oidc.authorizationCodeGrant(
        await this.client(config),
        url,
        {
          expectedState: input.state,
          expectedNonce: input.nonce,
          pkceCodeVerifier: input.codeVerifier,
          idTokenExpected: true,
        },
      );
      // claims() используется только после проверки протокола, времени, audience,
      // nonce и JWS/JWKS библиотекой. Никаких decode-only путей.
      const claims = tokens.claims();
      if (
        !claims ||
        claims.iss !== config.issuer ||
        typeof claims.sub !== 'string' ||
        !claims.sub ||
        claims.sub.length > 255 ||
        /\p{Cc}/u.test(claims.sub)
      ) {
        throw new AdminOidcError('keycloak_invalid');
      }
      // Upstream access/refresh/ID tokens не сохраняются и не выдаются браузеру.
      return { issuer: claims.iss, subject: claims.sub };
    } catch (error) {
      const failure = transportFailure(error);
      if (failure) throw failure;
      if (
        error instanceof oidc.AuthorizationResponseError &&
        error.error === 'access_denied'
      )
        throw new AdminOidcError('keycloak_denied');
      throw new AdminOidcError('keycloak_invalid');
    }
  }
}
