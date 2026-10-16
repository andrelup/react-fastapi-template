import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { CollectionsList } from './CollectionsList';

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

const rawViewerUser = { id: 3, email: 'bob@example.com', name: 'Bob Smith', role: 'viewer' };
const rawEditorUser = { id: 7, email: 'ada@example.com', name: 'Ada Lovelace', role: 'editor' };
const rawAdminUser = { id: 9, email: 'admin@example.com', name: 'Admin', role: 'admin' };

const rawCollection = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  name: 'Clásicos',
  description: 'Los imprescindibles.',
  version: 1,
  ...overrides,
});

const rawPage = (items: unknown[] = [rawCollection()], overrides = {}) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 20,
  ...overrides,
});

/** One implementation keyed on path: `/auth/me` (session rehydration) and
 * the screen's own fetch share the same `apiClient.get` mock. */
const mockApiClient = async (
  rawUser: typeof rawViewerUser,
  collections: (path: string) => unknown | Promise<unknown>,
) => {
  const { apiClient } = await import('@/lib/api-client');
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      return rawUser;
    }
    if (path.startsWith('/collections')) {
      return collections(path);
    }
    throw new Error(`Unexpected path: ${path}`);
  });
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  return apiClient;
};

const renderList = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/colecciones']}>
        <Routes>
          <Route path="/colecciones" element={<CollectionsList />} />
          <Route path="/colecciones/:id" element={<h1>Detalle de la colección</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('CollectionsList', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it.each([
    ['viewer', rawViewerUser],
    ['editor', rawEditorUser],
  ])('lists the collections for a %s, without the create action', async (_role, rawUser) => {
    await mockApiClient(rawUser, () => rawPage());

    renderList();

    expect(await screen.findByRole('heading', { name: 'Clásicos' })).toBeInTheDocument();
    expect(screen.getByText('Los imprescindibles.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva colección' })).not.toBeInTheDocument();
  });

  it('offers the create action to an ADMIN', async () => {
    await mockApiClient(rawAdminUser, () => rawPage());

    renderList();

    expect(await screen.findByRole('heading', { name: 'Clásicos' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Nueva colección' })).toHaveAttribute(
      'href',
      '/colecciones/nueva',
    );
  });

  it('navigates to the detail route when a card is selected', async () => {
    const user = userEvent.setup();
    await mockApiClient(rawViewerUser, () => rawPage());

    renderList();

    await user.click(await screen.findByRole('button', { name: 'Clásicos' }));

    expect(await screen.findByRole('heading', { name: 'Detalle de la colección' })).toBeVisible();
  });

  it('shows the empty state when there are no collections', async () => {
    await mockApiClient(rawViewerUser, () => rawPage([]));

    renderList();

    expect(await screen.findByText('Todavía no hay colecciones')).toBeInTheDocument();
  });

  it('shows the server error state on failure and retries on demand', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/types/api');
    let failing = true;
    await mockApiClient(rawViewerUser, () => {
      if (failing) {
        throw new ApiError('Server error', 500);
      }
      return rawPage();
    });

    renderList();

    expect(await screen.findByRole('heading', { name: 'Error del servidor' })).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('heading', { name: 'Clásicos' })).toBeInTheDocument();
  });

  it('requests the next page when Pagination is used', async () => {
    const user = userEvent.setup();
    const apiClient = await mockApiClient(rawViewerUser, (path) =>
      path.includes('page=2')
        ? rawPage([rawCollection({ id: 2, name: 'Novedades' })], { total: 40, page: 2 })
        : rawPage([rawCollection()], { total: 40 }),
    );

    renderList();

    await screen.findByRole('heading', { name: 'Clásicos' });
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(await screen.findByRole('heading', { name: 'Novedades' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/collections?page=2&page_size=20');
  });
});
