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
import {
  effectivePermissions,
  type AdminPermission,
} from '../../modules/admin-access/admin-permissions';
import { ApiErrorDto } from '../http/api-error.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { PUBLIC_ENDPOINT } from './public.decorator';

const ADMIN_PERMISSIONS = 'adminPermissions';

export function AdminPermissions(...permissions: AdminPermission[]) {
  return applyDecorators(
    SetMetadata(ADMIN_PERMISSIONS, permissions),
    ApiExtension('x-admin-permissions', permissions),
    ApiForbiddenResponse({
      type: ApiErrorDto,
      description: `Недостаточно прав. Требуются: ${permissions.join(', ')}.`,
    }),
  );
}

// Регистрируется только в Admin API, после AccessGuard. Роль всегда читается
// из БД, а не из JWT; у нового закрытого endpoint без матрицы прав доступ запрещён.
@Injectable()
export class AdminPermissionsGuard implements CanActivate {
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
        OR: [{ identityId: null }, { identity: { revokedAt: null } }],
      },
      select: { user: { select: { accessRole: true } } },
    });
    if (!session) throw new UnauthorizedException('Session is inactive');
    const required = this.reflector.getAllAndOverride<AdminPermission[]>(
      ADMIN_PERMISSIONS,
      targets,
    );
    const granted = effectivePermissions(session.user.accessRole);
    if (
      !required?.length ||
      !required.every((permission) => granted.includes(permission))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для этого действия.',
      });
    }
    return true;
  }
}
