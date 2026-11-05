import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  onApplicationBootstrap(): void {
    this.run();
    this.timer = setInterval(() => this.run(), 60_000);
    this.timer.unref();
  }

  private run(): void {
    if (this.pending) return;
    this.pending = this.cleanup()
      .catch(() => {
        this.logger.warn(
          'Expired session cleanup failed; it will be retried on the next interval.',
        );
      })
      .finally(() => {
        this.pending = undefined;
      });
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    if (this.config.realm === 'client') {
      await this.prisma.clientSession.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      return;
    }
    await this.prisma.$transaction([
      this.prisma.adminSession.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      this.prisma.adminOidcTransaction.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      this.prisma.adminOidcCompletion.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.pending;
  }
}
