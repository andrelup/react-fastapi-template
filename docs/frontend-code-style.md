# Frontend Code Style — ESLint, Prettier and TypeScript

New frontend code **must pass the linting, formatting and type-checking rules already configured**
in `frontend/`. These are not suggestions: two of them run as pre-commit hooks and block the
commit, and the third blocks the build.

Companion documents: [architecture](./frontend-architecture.md),
[UI components](./frontend-ui-components.md), [testing](./frontend-testing.md).

---

## 1. Commands

Run everything from the repo root:

```bash
npm --prefix frontend run lint          # eslint src --max-warnings=0
npm --prefix frontend run lint:fix      # eslint src --fix
npm --prefix frontend run format        # prettier --write .
npm --prefix frontend run format:check  # prettier --check .   (what the hook runs)
npm --prefix frontend run typecheck     # tsc --noEmit
npm --prefix frontend run test          # vitest run
```

`npm --prefix frontend run build` runs `tsc --noEmit && vite build`, so a type error breaks the
build even though it does not break the commit.

---

## 2. ESLint

`frontend/eslint.config.js` is an ESLint 9 **flat config**:

```js
export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  prettierConfig,
);
```

What this means in practice:

- **`any` is an error, not a warning.** Use `unknown` plus narrowing, or a proper type. There is no
  escape hatch configured.
- **Unused variables are a warning — and warnings fail.** The lint script runs with
  `--max-warnings=0`, so every warn-level rule is effectively an error. An intentionally unused
  function parameter must be prefixed with `_`.
- **The rules of hooks are enforced** (`react-hooks/rules-of-hooks`,
  `react-hooks/exhaustive-deps`). Do not silence `exhaustive-deps` with a blanket disable comment;
  fix the dependency array or restructure the effect.
- **`react-refresh/only-export-components`** warns when a module exports both a component and
  something else. This is why constants and helpers live in their own module rather than next to a
  component.
- **`eslint-config-prettier` is applied last**, so ESLint owns correctness and Prettier owns
  formatting. Never add a stylistic ESLint rule — it will be turned off anyway.
- Type-aware linting is **not** enabled (no `parserOptions.project`), so rules that need type
  information are unavailable. Type safety comes from `tsc`, not from ESLint.
- Tests are linted exactly like production code. The only ignore is `dist`.

---

## 3. Prettier

`frontend/prettier.config.js`, in full:

```js
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
};
```

So: semicolons, single quotes, trailing commas everywhere, 100-column lines, 2-space indent.
`.prettierignore` excludes `node_modules`, `dist`, `coverage` and `package-lock.json`.

The pre-commit hook runs `format:check`, **not** `--write`. It reports the problem and blocks the
commit; it does not fix it for you. Run `npm --prefix frontend run format` before committing.

Never argue with Prettier in review: reformat and move on.

---

## 4. TypeScript

`frontend/tsconfig.json` sets, among the usual Vite options:

```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"jsx": "react-jsx",
"noEmit": true,
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

Consequences for the code you write:

- **`strict: true`** — no implicit `any`, strict null checks, strict function types. Every value
  that can be `null` or `undefined` must be narrowed before use.
- **`noUnusedLocals` / `noUnusedParameters`** — a declared-but-unused local or parameter is a
  **compile error**, stricter than ESLint's warning. The `_` prefix convention satisfies ESLint but
  not `tsc`; delete what you do not use.
- **`noFallthroughCasesInSwitch`** — every `case` needs a `break` or `return`.
- **`jsx: react-jsx`** — do not import `React` just to write JSX.
- **`noEmit`** — `tsc` is only a type-checker; Vite/esbuild produces the bundle.
- **`paths`** — the `@/` alias. It is mirrored in `vite.config.ts` (`resolve.alias`); if you ever
  add another alias, add it in **both** files or the build and the editor will disagree.

`verbatimModuleSyntax` is not enabled, so `import type` is not compiler-enforced — but use it
anyway for type-only imports; it documents intent and keeps the emitted graph clean.

Explicit typing rules that follow from the codebase:

- Props are declared as `interface XxxProps`, never a `type` alias.
- Exported functions carry an explicit return type (`(): AuthContextValue`, `Promise<User>`).
- Backend DTOs are typed separately (`RawUser`) from the domain types (`User`), and converted in
  the feature's `api/` module.

---

## 5. Pre-commit gate

Two frontend hooks are configured in the root `.pre-commit-config.yaml`:

| Hook | Trigger | Command |
|---|---|---|
| `frontend-eslint` | staged file matching `^frontend/src/.*\.(ts\|tsx)$` | `npm --prefix frontend run lint` |
| `frontend-prettier` | staged file matching `^frontend/.*\.(ts\|tsx\|js\|json\|css\|html\|md)$` | `npm --prefix frontend run format:check` |

Both use `pass_filenames: false` and run against the whole tree, because ESLint 9's flat config has
to run from `frontend/` as its working directory. Both use `language: system`, so
`frontend/node_modules` must be installed first (`make setup` or `make install-hooks`).

**The hooks do not run the tests and do not run `tsc`.** That gap is yours to close: before opening
a PR, run `npm --prefix frontend run typecheck` and `npm --prefix frontend run test` yourself.

---

## 6. Checklist

- [ ] `npm --prefix frontend run lint` passes with **zero warnings**.
- [ ] `npm --prefix frontend run format:check` passes (run `format` first if not).
- [ ] `npm --prefix frontend run typecheck` passes.
- [ ] No `any` anywhere; no unused locals or parameters.
- [ ] No `eslint-disable` comment without a one-line justification next to it.
- [ ] Props typed with an `interface`; explicit return types on exported functions.
- [ ] New aliases added to both `tsconfig.json` and `vite.config.ts`.
