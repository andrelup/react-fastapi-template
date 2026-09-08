/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
});
