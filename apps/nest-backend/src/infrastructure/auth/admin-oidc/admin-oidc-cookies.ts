import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import {
  isOidcToken,
  OIDC_BROWSER_COOKIE_TTL_MS,
  OIDC_COMPLETION_TTL_MS,
} from './oidc-values';

@Injectable()
export class AdminOidcCookies {
  private name(kind: 'browser' | 'complete', secure: boolean): string {
    return `${secure ? '__Host-' : ''}admin_oidc_${kind}`;
  }
  private options(secure: boolean): CookieOptions {
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    };
  }

  private readValue(
    request: Request,
    kind: 'browser' | 'complete',
    secure: boolean,
  ): string | undefined {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') return undefined;
    const value: unknown = (cookies as Record<string, unknown>)[
      this.name(kind, secure)
    ];
    return isOidcToken(value) ? value : undefined;
  }

  read(
    request: Request,
    kind: 'browser' | 'complete',
    callbackUrl: string,
  ): string | undefined {
    return this.readValue(
      request,
      kind,
      new URL(callbackUrl).protocol === 'https:',
    );
  }

  readBrowserTokens(request: Request): string[] {
    return [false, true]
      .map((secure) => this.readValue(request, 'browser', secure))
      .filter((value): value is string => value !== undefined);
  }

  set(
    response: Response,
    kind: 'browser' | 'complete',
    token: string,
    callbackUrl: string,
  ): void {
    const secure = new URL(callbackUrl).protocol === 'https:';
    response.cookie(this.name(kind, secure), token, {
      ...this.options(secure),
      maxAge:
        kind === 'browser'
          ? OIDC_BROWSER_COOKIE_TTL_MS
          : OIDC_COMPLETION_TTL_MS,
    });
  }

  clear(response: Response): void {
    for (const secure of [false, true]) {
      response.clearCookie(this.name('browser', secure), this.options(secure));
      response.clearCookie(this.name('complete', secure), this.options(secure));
    }
  }
}
