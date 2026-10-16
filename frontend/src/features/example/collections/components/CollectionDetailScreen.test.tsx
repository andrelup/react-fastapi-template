import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { CollectionDetailScreen } from './CollectionDetailScreen';

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
  items: [
    { id: 5, name: 'Cámara analógica' },
    { id: 8, name: 'Tocadiscos vintage' },
  ],
  ...overrides,
});

/** One implementation keyed on path: `/auth/me` and the screen's own fetch
 * share the same `apiClient.get` mock. */
const mockApiClient = async (
  rawUser: typeof rawViewerUser,
  collection: ReturnType<typeof rawCollection> | 'not-found' | 'server-error',
) => {
  const { apiClient } = await import('@/lib/api-client');
  const { ApiError } = await import('@/types/api');
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      return rawUser;
    }
    if (path === '/collections/1') {
      if (collection === 'not-found') {
        throw new ApiError('Collection not found', 404);
      }
      if (collection === 'server-error') {
        throw new ApiError('Server error', 500);
      }
      return collection;
    }
    throw new Error(`Unexpected path: ${path}`);
  });
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  return apiClient;
};

const renderScreen = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/colecciones/1']}>
        <Routes>
          <Route path="/colecciones/:id" element={<CollectionDetailScreen />} />
          <Route path="/colecciones" element={<h1>Listado de colecciones</h1>} />
          <Route path="/" element={<h1>Inicio</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('CollectionDetailScreen', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the name, the description and its items as links to the item', async () => {
    await mockApiClient(rawViewerUser, rawCollection());

    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Clásicos' })).toBeInTheDocument();
    expect(screen.getByText('Los imprescindibles.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cámara analógica' })).toHaveAttribute(
      'href',
      '/items/5',
    );
    expect(screen.getByRole('link', { name: 'Tocadiscos vintage' })).toHaveAttribute(
      'href',
      '/items/8',
    );
  });

  it('shows a message when the collection has no items', async () => {
    await mockApiClient(rawViewerUser, rawCollection({ items: [], description: null }));

    renderScreen();

    await screen.findByRole('heading', { name: 'Clásicos' });
    expect(screen.getByText('Esta colección todavía no tiene artículos.')).toBeInTheDocument();
  });

  it.each([
    ['viewer', rawViewerUser],
    ['editor', rawEditorUser],
  ])('shows no action at all for a %s', async (_role, rawUser) => {
    await mockApiClient(rawUser, rawCollection());

    renderScreen();

    await screen.findByRole('heading', { name: 'Clásicos' });
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Acciones de la colección' }),
    ).not.toBeInTheDocument();
  });

  it('shows Edit and Delete for an ADMIN', async () => {
    await mockApiClient(rawAdminUser, rawCollection());

    renderScreen();

    await screen.findByRole('heading', { name: 'Clásicos' });
    const desktopActions = await screen.findByRole('group', { name: 'Acciones de la colección' });
    expect(within(desktopActions).getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/colecciones/1/editar',
    );
    expect(within(desktopActions).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('deletes through the confirm dialog and goes back to the listing', async () => {
    const user = userEvent.setup();
    const apiClient = await mockApiClient(rawAdminUser, rawCollection());
    vi.mocked(apiClient.delete).mockResolvedValueOnce(null);

    renderScreen();

    const desktopActions = await screen.findByRole('group', { name: 'Acciones de la colección' });
    await user.click(within(desktopActions).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(apiClient.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar colección' }));

    await screen.findByRole('heading', { name: 'Listado de colecciones' });
    expect(apiClient.delete).toHaveBeenCalledWith('/collections/1');
  });

  it('stays on the page and shows the error when the delete fails', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/types/api');
    const apiClient = await mockApiClient(rawAdminUser, rawCollection());
    vi.mocked(apiClient.delete).mockRejectedValueOnce(new ApiError('Forbidden', 403));

    renderScreen();

    const desktopActions = await screen.findByRole('group', { name: 'Acciones de la colección' });
    await user.click(within(desktopActions).getByRole('button', { name: 'Eliminar' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar colección' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByRole('heading', { name: 'Clásicos' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Listado de colecciones' }),
    ).not.toBeInTheDocument();
  });

  it('shows the 404 state for a collection that does not exist', async () => {
    await mockApiClient(rawViewerUser, 'not-found');

    renderScreen();

    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
  });

  it('shows the server error state for a 500', async () => {
    await mockApiClient(rawViewerUser, 'server-error');

    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Error del servidor' })).toBeInTheDocument();
  });
});
