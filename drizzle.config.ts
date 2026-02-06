import type { Config } from 'drizzle-kit';

export default {
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/src/db/migrations',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'arbor',
    password: process.env.DB_PASSWORD || 'local_dev_only',
    database: process.env.DB_NAME || 'arbor',
  },
  verbose: true,
  strict: true,
} satisfies Config;

