import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Build and report output. ESLint 9 walks every `.js` under `.`, so without
  // this it lints the generated reports and flags their bundled `eslint-disable`
  // banners as unused directives. Mirrors what .gitignore already excludes.
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'blob-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // src/components/ui/: shadcn/ui components co-export their `cva()` variant
    // factory (`buttonVariants`, `badgeVariants`) next to the component itself,
    // which `allowConstantExport` does not cover. Scoped to this folder only.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // e2e/: Playwright specs and page objects run under Node, not the
    // browser, and are plain TypeScript modules — no React, no hooks.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['e2e/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // Debe ir el ultimo: desactiva las reglas de ESLint que chocan con Prettier.
  prettierConfig,
);
