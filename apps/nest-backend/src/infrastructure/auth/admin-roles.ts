import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiExtension, ApiForbiddenResponse } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/client';
import { ApiErrorDto } from '../http/api-error.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { PUBLIC_ENDPOINT } from './public.decorator';

const ADMIN_ROLES = 'adminRoles';

export function AdminRoles(...roles: AdminRole[]) {
  return applyDecorators(
    SetMetadata(ADMIN_ROLES, roles),
    ApiExtension('x-admin-roles', roles),
    ApiForbiddenResponse({
      type: ApiErrorDto,
      description: `Недостаточно прав. Разрешённые роли: ${roles.join(', ')}.`,
    }),
  );
}

// Регистрируется только в Admin API, после AccessGuard. Роль всегда читается
// из БД, а не из JWT; у нового закрытого endpoint без матрицы прав доступ запрещён.
@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT, targets))
      return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Access token required');
    const session = await this.prisma.adminSession.findFirst({
      where: {
        id: request.user.sessionId,
        userId: request.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      select: { user: { select: { role: true } } },
    });
    if (!session) throw new UnauthorizedException('Session is inactive');
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES,
      targets,
    );
    if (!roles?.includes(session.user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для этого действия.',
      });
    }
    return true;
  }
}
