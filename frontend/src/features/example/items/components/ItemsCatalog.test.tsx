import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { ItemsCatalog } from './ItemsCatalog';

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

const rawItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  name: 'Cámara analógica',
  description: 'Una cámara de 35mm en buen estado.',
  category: 'electronica',
  tags: ['vintage'],
  owner_id: 7,
  version: 1,
  ...overrides,
});

// The catalogue navigates and asks `useAuth` about the role, so it needs a
// router and an `AuthProvider` in its render tree — see
// docs/frontend-testing.md section 6. Without a stored token the provider
// makes no request, so the chained one-shot mocks below stay valid.
const renderCatalog = (mine = false) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/items']}>
        <Routes>
          <Route path="/items" element={<ItemsCatalog mine={mine} />} />
          <Route path="/items/nuevo" element={<h1>Formulario de alta</h1>} />
          <Route path="/items/:id" element={<h1>Detalle del artículo</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

// Session helper: the provider (`/auth/me`) and the listing share one mock.
const mockSession = async (role: string) => {
  const { apiClient } = await import('@/lib/api-client');
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      return { id: 7, email: 'ada@example.com', name: 'Ada', role };
    }
    return { items: [], total: 0, page: 1, page_size: 20 };
  });
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
};

describe('ItemsCatalog', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('lists the items returned by the raw paginated response', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem(), rawItem({ id: 2, name: 'Tocadiscos vintage' })],
      total: 2,
      page: 1,
      page_size: 20,
    });

    renderCatalog();

    expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tocadiscos vintage' })).toBeInTheDocument();
  });

  it('navigates to the item detail route when a card is selected', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 1,
      page: 1,
      page_size: 20,
    });

    renderCatalog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cámara analógica' }));

    expect(
      await screen.findByRole('heading', { name: 'Detalle del artículo' }),
    ).toBeInTheDocument();
  });

  it('searches the catalogue and shows the matching results', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 1,
      page: 1,
      page_size: 20,
    });

    renderCatalog();
    await screen.findByRole('heading', { name: 'Cámara analógica' });

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem({ id: 3, name: 'Máquina de escribir' })],
      total: 1,
      page: 1,
      page_size: 20,
    });

    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }), 'escribir');

    expect(await screen.findByRole('heading', { name: 'Máquina de escribir' })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith(
        expect.stringContaining('/items/search?q=escribir'),
      ),
    );
  });

  it('requests the next page when Pagination is used', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 45,
      page: 1,
      page_size: 20,
    });

    renderCatalog();
    await screen.findByRole('heading', { name: 'Cámara analógica' });

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem({ id: 9, name: 'Radio de válvulas' })],
      total: 45,
      page: 2,
      page_size: 20,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));

    expect(await screen.findByRole('heading', { name: 'Radio de válvulas' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenLastCalledWith('/items?page=2&page_size=20');
  });

  it('shows the empty state when the catalogue genuinely has no items', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    renderCatalog();

    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay artículos' }),
    ).toBeInTheDocument();
  });

  it('shows the no-results state when a search yields nothing, and clears it on demand', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 1,
      page: 1,
      page_size: 20,
    });

    renderCatalog();
    await screen.findByRole('heading', { name: 'Cámara analógica' });

    vi.mocked(apiClient.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20 });

    const user = userEvent.setup();
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }),
      'algo-inexistente',
    );

    expect(await screen.findByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument();

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 1,
      page: 1,
      page_size: 20,
    });

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
  });

  it('shows the server error state when the request fails, and retries on demand', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const { ApiError } = await import('@/types/api');
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError('Server error', 500));

    renderCatalog();

    expect(await screen.findByRole('heading', { name: 'Error del servidor' })).toBeInTheDocument();

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem()],
      total: 1,
      page: 1,
      page_size: 20,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
  });

  it('offers the new-item link to an editor', async () => {
    const user = userEvent.setup();
    await mockSession('editor');

    renderCatalog();

    await user.click(await screen.findByRole('link', { name: 'Nuevo artículo' }));

    expect(await screen.findByRole('heading', { name: 'Formulario de alta' })).toBeInTheDocument();
  });

  it('does not offer the new-item link to a viewer', async () => {
    await mockSession('viewer');

    renderCatalog();

    const { apiClient } = await import('@/lib/api-client');
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/auth/me'));
    await screen.findByRole('heading', { name: 'Catálogo' });
    expect(screen.queryByRole('link', { name: 'Nuevo artículo' })).not.toBeInTheDocument();
  });

  describe('owner view («Mis items»)', () => {
    const rawMe = (role: string) => ({ id: 7, email: 'ada@example.com', name: 'Ada', role });
    const emptyPage = { items: [], total: 0, page: 1, page_size: 20 };

    const mockOwnerSession = async (role: string, page: unknown = emptyPage) => {
      const { apiClient } = await import('@/lib/api-client');
      vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
        path === '/auth/me' ? rawMe(role) : page,
      );
      window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
      return apiClient;
    };

    it('waits for the session, then requests only the items of that user', async () => {
      const { apiClient } = await import('@/lib/api-client');
      let resolveMe: (value: unknown) => void = () => undefined;
      vi.mocked(apiClient.get).mockImplementation((path: string) =>
        path === '/auth/me'
          ? new Promise((resolve) => {
              resolveMe = resolve;
            })
          : Promise.resolve({ items: [rawItem()], total: 1, page: 1, page_size: 20 }),
      );
      window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

      renderCatalog(true);

      expect(await screen.findByRole('status', { name: 'Cargando' })).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledWith('/auth/me');

      resolveMe(rawMe('viewer'));

      expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Mis items' })).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledWith('/items/search?owner_id=7&page=1&page_size=20');
      expect(apiClient.get).not.toHaveBeenCalledWith('/items?page=1&page_size=20');
    });

    it('keeps the owner filter while searching and filtering', async () => {
      const apiClient = await mockOwnerSession('viewer', {
        items: [rawItem()],
        total: 1,
        page: 1,
        page_size: 20,
      });

      renderCatalog(true);
      await screen.findByRole('heading', { name: 'Cámara analógica' });

      const user = userEvent.setup();
      await user.type(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }), 'cam');

      await waitFor(() =>
        expect(apiClient.get).toHaveBeenLastCalledWith(
          '/items/search?q=cam&owner_id=7&page=1&page_size=20',
        ),
      );
    });

    it('shows its own empty state to a viewer', async () => {
      await mockOwnerSession('viewer');

      renderCatalog(true);

      expect(
        await screen.findByRole('heading', { name: 'Todavía no has creado ningún artículo' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Todavía no hay artículos' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Nuevo artículo' })).not.toBeInTheDocument();
    });

    it.each(['editor', 'admin'])(
      'offers only the header link, no duplicate create action, to an %s',
      async (role) => {
        await mockOwnerSession(role);

        renderCatalog(true);

        await screen.findByRole('heading', { name: 'Todavía no has creado ningún artículo' });
        expect(screen.getByRole('link', { name: 'Nuevo artículo' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Crear/ })).not.toBeInTheDocument();
      },
    );

    it('shows the no-results state, not the empty one, when a filter matches nothing', async () => {
      await mockOwnerSession('editor');

      renderCatalog(true);
      await screen.findByRole('heading', { name: 'Todavía no has creado ningún artículo' });

      const user = userEvent.setup();
      await user.type(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }), 'nada');

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole('heading', { name: 'Todavía no has creado ningún artículo' }),
      ).toBeNull();
    });
  });
});
