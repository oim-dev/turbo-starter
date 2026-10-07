import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/infrastructure/config/environment';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node src/cli/seed-admin.ts',
  },
  datasource: { url: databaseUrl() },
});
