/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireApiUrl } from './src/lib/env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The monorepo has a single .env, at its root, shared with the backend; Vite
// would otherwise look in frontend/. Only VITE_-prefixed variables reach the
// bundle, so the backend's secrets in that file never do.
const envDir = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  // Stop `vite`, `vite build` and `vitest` before they start if the API URL is
  // missing. loadEnv also reads the process env, which is how the Docker
  // build passes it (build arg → ENV).
  requireApiUrl(loadEnv(mode, envDir, 'VITE_'));

  return {
    envDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      // Playwright's specs live under `e2e/**/*.spec.ts`, which otherwise
      // matches Vitest's default test glob and would be picked up by
      // `vitest run` too.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: [
          '**/*.test.{ts,tsx}',
          'src/test/**',
          'src/app/main.tsx',
          '**/*.d.ts',
          'src/types/**',
          'src/features/*/types/**',
          'src/features/*/index.ts',
        ],
        reporter: ['text', 'lcov'],
        thresholds: {
          statements: 80,
          lines: 80,
          branches: 80,
          functions: 80,
        },
      },
    },
  };
});
