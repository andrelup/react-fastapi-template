# Frontend Testing

How tests are written in `frontend/`: Vitest + React Testing Library, colocated with the code they
cover. This document describes the conventions **the existing 21 test files actually follow**, so a
new test looks like the ones already there.

Companion documents: [architecture](./frontend-architecture.md),
[UI components](./frontend-ui-components.md), [code style](./frontend-code-style.md).

---

## 1. Setup

Vitest is configured inside `frontend/vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  css: true,
}
```

`src/test/setup.ts` registers the jest-dom matchers and cleans the DOM after each test:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

**`globals` is not enabled.** Every test file explicitly imports what it uses:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
```

Commands:

```bash
npm --prefix frontend run test        # vitest run
npm --prefix frontend run test:watch  # vitest
npx --prefix frontend vitest run --coverage
```

---

## 2. Rules

1. **Colocation.** The test sits next to the file it covers: `Button.test.tsx` beside `Button.tsx`.
   No `__tests__/` folders. Use `.test.tsx` for anything rendering JSX, `.test.ts` for pure
   functions.
2. **Test behaviour, not implementation.** Never assert on class names, internal state or the
   number of renders. Assert what a user can perceive.
3. **Query priority: `getByRole` first.** The codebase uses it 104 times across 19 files.
   `getByLabelText` for form fields, `getByText` for content with no accessible role.
   **`getByTestId` is never used — do not introduce it.** If an element is unreachable by role,
   that is an accessibility bug in the component; fix the component.
4. **`userEvent`, not `fireEvent`.** Always `const user = userEvent.setup();` then
   `await user.click(...)`. (`MobileTabBar.test.tsx` still uses `fireEvent`; it is the exception,
   not the model.)
5. **`describe`/`it` text in English**, like all code in this repo. The strings you *assert on* are
   the real product copy, which is Spanish — that is expected.
6. **Never hit the network.** Mock `@/lib/api-client`; see §4.
7. **Every new component gets a test.** Minimum coverage for the project is 80 %.

---

## 3. Anatomy of a test

Phrase each `it` as an observable behaviour, not as a method name:

```tsx
it('redirects to the originally requested destination after a successful login', async () => {
```

Structure the body as arrange → act → assert, without needing comments to say so:

```tsx
it('renders the action button and fires onAction when clicked', async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();

  render(<EmptyState title="No books" description="Add your first book." actionLabel="Add" onAction={onAction} />);

  await user.click(screen.getByRole('button', { name: 'Add' }));

  expect(onAction).toHaveBeenCalledTimes(1);
});
```

Assert absence with `queryBy*`, never with `getBy*` in a `try`:

```tsx
expect(screen.queryByRole('button')).not.toBeInTheDocument();
```

---

## 4. Mocking the backend

There is no MSW and no `fetch` stubbing. Mock the API client module wholesale at module scope, then
grab a typed handle inside the test:

```tsx
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

// inside the test
const { apiClient } = await import('@/lib/api-client');
vi.mocked(apiClient.get).mockResolvedValueOnce(rawUser);
```

Note the mock returns the **raw backend DTO** (`snake_case`, as the API sends it), because the
feature's `api/` module is what maps it to the domain type — mocking the mapped shape would skip
the code under test.

## 5. Simulating a session

The token lives in `localStorage`, so a logged-in user is set up by writing it before rendering and
letting `AuthProvider` rehydrate the user through the mocked client:

```tsx
window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
```

Always clean up:

```tsx
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});
```

Because rehydration is asynchronous, assertions on gated content use `findBy*`, not `getBy*`.

---

## 6. Wrapping providers and the router

There is no shared render helper. Each file declares its own small `renderXxx()` factory, wrapping
`AuthProvider` and `MemoryRouter` (adding `Routes`/`Route` only when the test asserts navigation):

```tsx
const renderComponent = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
```

Rendering a sibling route with a marker element is the idiomatic way to assert a redirect happened.

---

## 7. Templates

### Presentational component

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders the given title and description', () => {
    render(<MyComponent title="Some title" description="Some description." />);

    expect(screen.getByRole('heading', { name: 'Some title' })).toBeInTheDocument();
    expect(screen.getByText('Some description.')).toBeInTheDocument();
  });

  it('does not render an action when no handler is provided', () => {
    render(<MyComponent title="Some title" description="Some description." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires onAction when the action is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<MyComponent title="Some title" description="…" actionLabel="Do it" onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Do it' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

### Component behind auth / routing

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { MyGatedComponent } from './MyGatedComponent';

const rawUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'seller' };

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setAuthToken: vi.fn(),
}));

const renderComponent = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/gated']}>
        <Routes>
          <Route path="/gated" element={<MyGatedComponent />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('MyGatedComponent', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders its content once the session is restored', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument();
  });
});
```

### Hook

Use `renderHook` from `@testing-library/react` (already installed — do not add another library):

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyHook } from './useMyHook';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setAuthToken: vi.fn(),
}));

describe('useMyHook', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the data once the request resolves', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({ id: 1, title: 'Some book' });

    const { result } = renderHook(() => useMyHook());

    await waitFor(() => expect(result.current.data).toEqual({ id: 1, title: 'Some book' }));
  });
});
```

### Pure function

```ts
import { describe, expect, it } from 'vitest';
import { formatPrice } from './format-price';

describe('formatPrice', () => {
  it('formats a price with two decimals and the euro symbol', () => {
    expect(formatPrice(12.5)).toBe('12,50 €');
  });
});
```

---

## 8. Async patterns

| Situation | Use |
|---|---|
| An element appears after an async effect or request | `await screen.findByRole(...)` |
| Assert a call happened, or a side effect settled | `await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(...))` |
| The element is already there synchronously | `screen.getByRole(...)` |

Never `await` a `getBy*` and never wrap an assertion in `setTimeout`.

---

## 9. What is not set up yet

Be aware, so you do not rely on it:

- **No E2E tests.** There is no `e2e/` directory, no `playwright.config.ts` and no
  `@playwright/test` dependency. The `make test-e2e` target is a placeholder. The Playwright +
  Page Object Model layout described in `frontend/CLAUDE.md` is target design, not current state.
- **No enforced coverage threshold** for the frontend: `@vitest/coverage-v8` is installed but no
  `test.coverage` block exists. The 80 % minimum is a project rule you uphold manually — check with
  `npx --prefix frontend vitest run --coverage`.
- **`make test` only runs the backend suite.** Run the frontend suite explicitly with
  `npm --prefix frontend run test`.
- **The pre-commit hooks do not run tests or `tsc`.** Run them yourself before opening a PR.

---

## 10. Checklist

- [ ] Test colocated next to the code it covers.
- [ ] `describe`/`it` in English, phrased as observable behaviour.
- [ ] `getByRole` first; no `getByTestId`.
- [ ] `userEvent`, awaited, for every interaction.
- [ ] `@/lib/api-client` mocked; no real network call.
- [ ] `localStorage` and mocks cleared in `afterEach`.
- [ ] Async assertions use `findBy*` / `waitFor`.
- [ ] `npm --prefix frontend run test` passes; coverage stays at or above 80 %.
