import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionTransport } from '../../generated/prisma/client';
import { AdminOidcCookies } from '../../infrastructure/auth/admin-oidc/admin-oidc-cookies';
import { AdminOidcProvider } from '../../infrastructure/auth/admin-oidc/admin-oidc-provider';
import {
  AdminOidcError,
  hashOidcToken,
  isOidcToken,
  OIDC_COMPLETION_TTL_MS,
  OIDC_TRANSACTION_TTL_MS,
  randomOidcToken,
  safeAdminReturnTo,
} from '../../infrastructure/auth/admin-oidc/oidc-values';
import {
  SessionService,
  type IssuedAccessToken,
} from '../../infrastructure/auth/session.service';
import { type EnabledAdminKeycloakConfig } from '../../infrastructure/config/admin-keycloak-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { lockAdminIdentity } from '../../modules/admin-users/admin-identity-lock';
import { AdminKeycloakSettingsService } from '../../modules/admin-settings/admin-keycloak-settings.service';
import { lockAdminSecurity } from '../../modules/admin-access/admin-permissions';

@Injectable()
export class AdminKeycloakService {
  constructor(
    private readonly settings: AdminKeycloakSettingsService,
    private readonly prisma: PrismaService,
    private readonly provider: AdminOidcProvider,
    private readonly cookies: AdminOidcCookies,
    private readonly sessions: SessionService,
  ) {}

  async providers(): Promise<{ local: boolean; keycloak: boolean }> {
    return { local: true, keycloak: await this.settings.isEnabled() };
  }

  private async enabled(): Promise<EnabledAdminKeycloakConfig> {
    const config = await this.settings.runtime();
    if (!config.enabled)
      throw new NotFoundException('Keycloak sign-in is disabled');
    return config;
  }

  private redirect(
    config: EnabledAdminKeycloakConfig,
    result: 'success' | 'error',
    returnTo = '/',
    error?: unknown,
  ): string {
    const url = new URL(config.frontendCallbackUrl);
    url.searchParams.set('result', result);
    if (result === 'success')
      url.searchParams.set('returnTo', safeAdminReturnTo(returnTo));
    else
      url.searchParams.set(
        'error',
        error instanceof AdminOidcError ? error.code : 'keycloak_unavailable',
      );
    return url.href;
  }

  async start(
    request: Request,
    response: Response,
    returnPath: unknown,
  ): Promise<string> {
    const config = await this.enabled();
    let returnTo: string;
    try {
      returnTo = safeAdminReturnTo(returnPath);
    } catch {
      return this.redirect(
        config,
        'error',
        '/',
        new AdminOidcError('keycloak_invalid'),
      );
    }
    try {
      const state = randomOidcToken();
      const browser = randomOidcToken();
      const nonce = randomOidcToken();
      const codeVerifier = randomOidcToken();
      const redirect = await this.provider.authorizationUrl(config, {
        state,
        nonce,
        codeVerifier,
      });
      // Новый вход отменяет предыдущий незавершённый flow этого браузера.
      // Основная Bearer-сессия здесь и в callback не создаётся и не меняется.
      const previous = this.cookies.read(request, 'browser', config.callbackUrl);
      await this.prisma.$transaction(async (tx) => {
        await lockAdminSecurity(tx);
        await this.settings.requireCurrent(tx, config.version);
        if (previous)
          await tx.adminOidcTransaction.deleteMany({
            where: { browserHash: hashOidcToken(previous) },
          });
        await tx.adminOidcTransaction.create({
          data: {
            stateHash: hashOidcToken(state),
            browserHash: hashOidcToken(browser),
            nonce,
            codeVerifier,
            issuer: config.issuer,
            clientId: config.clientId,
            configVersion: config.version,
            callbackUrl: config.callbackUrl,
            returnTo,
            expiresAt: new Date(Date.now() + OIDC_TRANSACTION_TTL_MS),
          },
        });
      });
      this.cookies.clear(response);
      this.cookies.set(response, 'browser', browser, config.callbackUrl);
      return redirect;
    } catch (error) {
      return this.redirect(config, 'error', '/', error);
    }
  }

  async callback(request: Request, response: Response): Promise<string> {
    const config = await this.enabled();
    try {
      if (request.originalUrl.length > 16_384)
        throw new AdminOidcError('keycloak_invalid');
      // Не доверяем Host/X-Forwarded-Host: redirect_uri всегда из конфигурации.
      const url = new URL(config.callbackUrl);
      url.search = new URL(
        request.originalUrl,
        'https://request.invalid',
      ).search;
      const state = url.searchParams.get('state');
      const browser = this.cookies.read(request, 'browser', config.callbackUrl);
      if (
        !isOidcToken(state) ||
        !browser ||
        url.searchParams.getAll('state').length !== 1
      )
        throw new AdminOidcError('keycloak_invalid');
      const transaction = await this.prisma.$transaction(async (tx) => {
        const result = await tx.adminOidcTransaction.updateMany({
          where: {
            stateHash: hashOidcToken(state),
            browserHash: hashOidcToken(browser),
            consumedAt: null,
            expiresAt: { gt: new Date() },
            issuer: config.issuer,
            clientId: config.clientId,
            configVersion: config.version,
            callbackUrl: config.callbackUrl,
          },
          data: { consumedAt: new Date() },
        });
        return result.count === 1
          ? tx.adminOidcTransaction.findUnique({
              where: { stateHash: hashOidcToken(state) },
            })
          : null;
      });
      if (!transaction) throw new AdminOidcError('keycloak_invalid');
      // Consume фиксируется ДО сетевого обмена: ambiguous failure нельзя повторять.
      const verified = await this.provider.identity(config, url, {
        state,
        nonce: transaction.nonce,
        codeVerifier: transaction.codeVerifier,
      });
      const existing = await this.prisma.adminIdentity.findUnique({
        where: { issuer_subject: verified },
      });
      if (!existing) throw new AdminOidcError('keycloak_denied');
      const completion = randomOidcToken();
      await this.prisma.$transaction(async (tx) => {
        await lockAdminSecurity(tx);
        await this.settings.requireCurrent(tx, config.version);
        const account = await lockAdminIdentity(
          tx,
          existing.userId,
          existing.id,
        );
        await tx.$queryRaw`SELECT "stateHash" FROM "AdminOidcTransaction" WHERE "stateHash" = ${transaction.stateHash} FOR UPDATE`;
        const flow = await tx.adminOidcTransaction.findUnique({
          where: { stateHash: transaction.stateHash },
        });
        const now = new Date();
        if (
          !account ||
          !flow ||
          !flow.consumedAt ||
          flow.expiresAt <= now ||
          account.user.authValidAfter >= transaction.createdAt ||
          account.identity.createdAt >= transaction.createdAt
        ) {
          throw new AdminOidcError('keycloak_denied');
        }
        await tx.adminOidcCompletion.create({
          data: {
            tokenHash: hashOidcToken(completion),
            transactionId: transaction.stateHash,
            identityId: existing.id,
            authVersion: account.user.authVersion,
            expiresAt: new Date(
              Math.min(
                now.getTime() + OIDC_COMPLETION_TTL_MS,
                flow.expiresAt.getTime(),
              ),
            ),
          },
        });
        // Обмен code завершён, PKCE/nonce больше не нужны даже до cleanup.
        await tx.adminOidcTransaction.update({
          where: { stateHash: transaction.stateHash },
          data: { codeVerifier: '', nonce: '' },
        });
      });
      this.cookies.set(response, 'complete', completion, config.callbackUrl);
      return this.redirect(config, 'success', transaction.returnTo);
    } catch (error) {
      // Ошибка старой вкладки не очищает credentials/новый pending flow другой вкладки.
      return this.redirect(config, 'error', '/', error);
    }
  }

  async complete(request: Request): Promise<IssuedAccessToken> {
    const config = await this.enabled();
    const token = this.cookies.read(request, 'complete', config.callbackUrl);
    const browser = this.cookies.read(request, 'browser', config.callbackUrl);
    const invalid = () =>
      new UnauthorizedException({
        code: 'KEYCLOAK_COMPLETION_INVALID',
        message:
          'Keycloak completion is missing, expired, already used or no longer authorized. Start a new sign-in.',
      });
    if (!token || !browser) throw invalid();
    const tokenHash = hashOidcToken(token);
    const initial = await this.prisma.adminOidcCompletion.findUnique({
      where: { tokenHash },
      include: { identity: true },
    });
    if (!initial) throw invalid();
    return this.prisma.$transaction(
      async (tx) => {
        await lockAdminSecurity(tx);
        await this.settings.requireCurrent(tx, config.version);
        const account = await lockAdminIdentity(
          tx,
          initial.identity.userId,
          initial.identityId,
        );
        await tx.$queryRaw`SELECT "stateHash" FROM "AdminOidcTransaction" WHERE "stateHash" = ${initial.transactionId} FOR UPDATE`;
        const grant = await tx.adminOidcCompletion.findUnique({
          where: { tokenHash },
          include: { transaction: true },
        });
        const now = new Date();
        if (
          !account ||
          !grant ||
          grant.consumedAt ||
          grant.expiresAt <= now ||
          grant.authVersion !== account.user.authVersion ||
          account.identity.issuer !== config.issuer ||
          grant.transaction.browserHash !== hashOidcToken(browser) ||
          grant.transaction.expiresAt <= now ||
          grant.transaction.issuer !== config.issuer ||
          grant.transaction.clientId !== config.clientId ||
          grant.transaction.configVersion !== config.version ||
          grant.transaction.callbackUrl !== config.callbackUrl ||
          account.user.authValidAfter >= grant.transaction.createdAt
        )
          throw invalid();
        const consumed = await tx.adminOidcCompletion.updateMany({
          where: { tokenHash, consumedAt: null },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw invalid();
        const session = await tx.adminSession.create({
          data: {
            userId: account.user.id,
            identityId: account.identity.id,
            transport: SessionTransport.BROWSER,
            expiresAt: this.sessions.newSessionExpiresAt(),
          },
        });
        // Consumption, новая сессия и signing атомарны; JWT в JSON только после commit.
        return this.sessions.issue(session);
      },
      { timeout: 10000 },
    );
  }

  async cancelBrowser(request: Request, response: Response): Promise<void> {
    const browsers = this.cookies.readBrowserTokens(request);
    try {
      if (browsers.length > 0)
        await this.prisma.adminOidcTransaction.deleteMany({
          where: { browserHash: { in: browsers.map(hashOidcToken) } },
        });
    } finally {
      this.cookies.clear(response);
    }
  }
}
