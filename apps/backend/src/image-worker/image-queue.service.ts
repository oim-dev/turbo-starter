import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import { isUUID } from 'class-validator';
import { ImageConfig } from '../infrastructure/config/image-config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ImageJobs, type ImageMessage } from './image-jobs.service';
import { ImageJobRunner } from './image-job-runner';

const WORK_QUEUE = 'images.process.v1';
const DEAD_QUEUE = 'images.dead.v1';

@Injectable()
export class ImageQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageQueue.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private consumerTag?: string;
  private timer?: NodeJS.Timeout;
  private tickTask?: Promise<void>;
  private stopped = false;
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ImageConfig,
    private readonly jobs: ImageJobs,
    private readonly runner: ImageJobRunner,
  ) {}

  onModuleInit(): void {
    // Даже worker начинает слушать lifecycle без ожидания RabbitMQ.
    this.timer = setInterval(() => this.schedule(), 2000);
    this.schedule();
  }

  private schedule(): void {
    if (this.stopped || this.tickTask) return;
    this.tickTask = this.tick()
      .catch(() => {
        this.logger.warn('Image scheduler unavailable; retrying.');
      })
      .finally(() => {
        this.tickTask = undefined;
      });
  }

  private async tick(): Promise<void> {
    // Recovery не зависит от broker: исчерпанные задания станут failed и получат DLQ outbox.
    await this.jobs.recover();
    if (!this.channel) await this.open();
    if (this.channel && !this.stopped) await this.publish(this.channel);
  }

  private async open(): Promise<void> {
    let connection: ChannelModel | undefined;
    try {
      const url = new URL(this.config.rabbitUrl);
      if (!url.searchParams.has('heartbeat'))
        url.searchParams.set('heartbeat', '15');
      connection = await connect(url.toString(), { timeout: 5000 });
      connection.on('error', () =>
        this.logger.warn('Image broker connection interrupted.'),
      );
      const channel = await connection.createConfirmChannel();
      channel.on('error', () =>
        this.logger.warn('Image broker channel interrupted.'),
      );
      const reset = () => {
        if (this.channel === channel) {
          this.channel = undefined;
          this.connection = undefined;
        }
        void connection?.close().catch(() => undefined);
      };
      channel.on('close', reset);
      connection.on('close', () => {
        if (this.connection === connection) {
          this.channel = undefined;
          this.connection = undefined;
        }
      });
      await channel.assertQueue(DEAD_QUEUE, { durable: true });
      await channel.assertQueue(WORK_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': DEAD_QUEUE,
        },
      });
      await channel.prefetch(this.config.concurrency);
      if (this.stopped) {
        await connection.close();
        return;
      }
      this.connection = connection;
      this.channel = channel;
      const consumer = await channel.consume(
        WORK_QUEUE,
        (message) => {
          if (!message) {
            reset();
            return;
          }
          const task = this.consume(channel, message).finally(() => {
            this.running.delete(task);
          });
          this.running.add(task);
        },
        { noAck: false },
      );
      this.consumerTag = consumer.consumerTag;
      this.logger.log('Image worker connected.');
    } catch {
      await connection?.close().catch(() => undefined);
      this.channel = undefined;
      this.connection = undefined;
    }
  }

  private async consume(
    channel: ConfirmChannel,
    message: ConsumeMessage,
  ): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(message.content.toString()) as unknown;
    } catch {
      /* malformed message */
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('jobId' in payload) ||
      !('dispatchVersion' in payload) ||
      typeof payload.jobId !== 'string' ||
      !isUUID(payload.jobId) ||
      typeof payload.dispatchVersion !== 'number' ||
      !Number.isSafeInteger(payload.dispatchVersion) ||
      payload.dispatchVersion < 1
    ) {
      try {
        channel.reject(message, false);
      } catch {
        /* closed channel redelivers */
      }
      return;
    }
    try {
      await this.runner.run(payload as ImageMessage);
      // ACK только после persist ready/failed/retry-outbox (или доказанного дубля).
      channel.ack(message);
    } catch {
      // При отказе БД нельзя ACK. Закрытие канала возвращает unacked сообщения
      // брокеру, scheduler восстановит lease; следующий reconnect через 2 секунды.
      this.logger.warn(
        'Image job not acknowledged; persistence or broker unavailable.',
      );
      await channel.close().catch(() => undefined);
    }
  }

  private async publish(channel: ConfirmChannel): Promise<void> {
    const now = new Date();
    const candidates = await this.prisma.imageOutbox.findMany({
      where: {
        publishedAt: null,
        availableAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const row of candidates) {
      if (this.stopped || channel !== this.channel) return;
      const leaseToken = randomUUID();
      const claimed = await this.prisma.imageOutbox.updateMany({
        where: {
          id: row.id,
          publishedAt: null,
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: {
          leaseToken,
          leaseUntil: new Date(Date.now() + this.config.leaseMs),
          attempts: { increment: 1 },
        },
      });
      if (!claimed.count) continue;
      try {
        const job = await this.prisma.imageJob.findUniqueOrThrow({
          where: { id: row.jobId },
        });
        if (
          row.destination === 'dead' ||
          (job.status === 'queued' &&
            job.dispatchVersion === row.dispatchVersion)
        ) {
          await new Promise<void>((resolve, reject) => {
            const finish = (error?: unknown) => {
              clearTimeout(timeout);
              channel.removeListener('return', returned);
              if (error)
                reject(
                  error instanceof Error
                    ? error
                    : new Error('Publisher rejected'),
                );
              else resolve();
            };
            const returned = (message: ConsumeMessage) => {
              if (message.properties.messageId === row.id)
                finish(new Error('Message was not routed'));
            };
            const timeout = setTimeout(
              () => finish(new Error('Publisher confirm timeout')),
              10000,
            );
            channel.on('return', returned);
            try {
              channel.sendToQueue(
                row.destination === 'dead' ? DEAD_QUEUE : WORK_QUEUE,
                Buffer.from(
                  JSON.stringify({
                    jobId: row.jobId,
                    dispatchVersion: row.dispatchVersion,
                  }),
                ),
                {
                  persistent: true,
                  mandatory: true,
                  contentType: 'application/json',
                  messageId: row.id,
                },
                finish,
              );
            } catch (error) {
              finish(error);
            }
          });
        }
        // Потеря соединения после confirm/перед commit допустима: доставка at-least-once.
        await this.prisma.imageOutbox.updateMany({
          where: { id: row.id, leaseToken },
          data: {
            publishedAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
          },
        });
      } catch {
        await this.prisma.imageOutbox.updateMany({
          where: { id: row.id, leaseToken },
          data: {
            leaseToken: null,
            leaseUntil: null,
            availableAt: new Date(
              Date.now() +
                Math.min(300000, 2000 * 2 ** Math.min(row.attempts, 8)),
            ),
          },
        });
        await channel.close().catch(() => undefined);
        return;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.channel && this.consumerTag)
      await this.channel.cancel(this.consumerTag).catch(() => undefined);
    await this.tickTask;
    // Graceful shutdown ждёт текущие задания; аварийное завершение восстановит lease.
    await Promise.allSettled(this.running);
    await this.connection?.close().catch(() => undefined);
  }
}
