import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from './public.decorator';

@Injectable()
export class BrowserOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');
    let validOrigin = false;
    if (origin) {
      try {
        const url = new URL(origin);
        validOrigin =
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.origin === origin &&
          !url.hostname.includes('*');
      } catch {
        // Некорректный, opaque или множественный Origin не является HTTP(S) origin.
      }
    }
    if (!validOrigin || request.get('x-csrf-protection') !== '1') {
      throw new ForbiddenException(
        'A valid HTTP(S) Origin and X-CSRF-Protection: 1 are required',
      );
    }
    return true;
  }
}

// Не делает endpoint публичным: logout дополнительно проходит Bearer/permissions guards.
export const BrowserRequest = () =>
  applyDecorators(
    UseGuards(BrowserOriginGuard),
    ApiHeader({
      name: 'Origin',
      required: true,
      description:
        'Корректный HTTP(S) Origin без пути, query или fragment. Принимается любой источник; allowlist не используется.',
    }),
    ApiHeader({
      name: 'X-CSRF-Protection',
      required: true,
      schema: { type: 'string', enum: ['1'] },
    }),
  );

export const BrowserAuth = () => applyDecorators(Public(), BrowserRequest());
