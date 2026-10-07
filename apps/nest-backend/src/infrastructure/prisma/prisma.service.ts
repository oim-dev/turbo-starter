import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { databaseUrl } from '../config/environment';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: databaseUrl(),
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        query_timeout: 10000,
        statement_timeout: 8000,
        idle_in_transaction_session_timeout: 10000,
        keepAlive: true,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
