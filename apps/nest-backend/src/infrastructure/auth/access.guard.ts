import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { AuthenticatedRequest } from './authenticated-request';
import { PUBLIC_ENDPOINT } from './public.decorator';
import { SessionService } from './session.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    const token = match?.[1];
    if (!token || token.length > 4096)
      throw new UnauthorizedException('Access token required');
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.jwtSecret,
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      typeof payload.sid !== 'string' ||
      !isUUID(payload.sid) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (!(await this.sessions.isActive(payload.sid, payload.sub)))
      throw new UnauthorizedException('Session is inactive');
    request.user = {
      id: payload.sub,
      sessionId: payload.sid,
      accessExpiresAt: payload.exp * 1000,
    };
    return true;
  }
}
