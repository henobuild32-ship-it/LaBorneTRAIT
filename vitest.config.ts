import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Variables utilisées par les modules testés (Prisma, JWT, paiements).
    // Aucun test n'ouvre réellement de connexion réseau ou base de données.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://user:password@localhost:5432/labornetrait_test',
      JWT_SECRET: 'vitest-jwt-secret-for-unit-tests',
      JWT_REFRESH_SECRET: 'vitest-jwt-refresh-secret-for-unit-tests',
      ADMIN_API_SECRET: 'vitest-admin-api-secret',
      HEALTHCHECK_SECRET_KEY: 'vitest-healthcheck-secret',
      GENIUSPAY_WEBHOOK_SECRET: 'vitest-geniuspay-webhook-secret',
      GENIUSPAY_API_KEY: 'placeholder_test_key',
      GENIUSPAY_API_SECRET: 'placeholder_test_secret',
    },
  },
});
