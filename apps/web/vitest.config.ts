import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'web',
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './tests/setup.ts')],
    include: [path.resolve(__dirname, './tests/**/*.test.{ts,tsx}')],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/.next/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

