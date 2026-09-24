import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { ItemDetailScreen } from './ItemDetailScreen';

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

const rawEditorUser = { id: 7, email: 'ada@example.com', name: 'Ada Lovelace', role: 'editor' };
const rawAdminUser = { id: 9, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const rawViewerUser = { id: 3, email: 'bob@example.com', name: 'Bob Smith', role: 'viewer' };

const rawItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  name: 'Cámara analógica',
  slug: 'camara-analogica',
  description: 'Una cámara de 35mm en buen estado.',
  category: 'electronica',
  tags: ['vintage'],
  owner_id: 7,
  version: 1,
  collections: [{ id: 1, name: 'Clásicos' }],
  ...overrides,
});

/**
 * Logs a role in and lets `AuthProvider` rehydrate it, exactly as
 * `RoleRoute.test.tsx` does, then wires `apiClient.get` for the item lookup.
 *
 * `apiClient.get` is drained by two callers — `AuthProvider`'s rehydration
 * (`/auth/me`) and the screen's `getItem` (`/items/1`) — so the mock is
 * keyed on the requested path with `mockImplementation` rather than chained
 * `mockResolvedValueOnce` calls, which would hand the wrong response to
 * whichever call happens to run first.
 */
const mockApiClient = async (
  rawUser: typeof rawEditorUser,
  item: ReturnType<typeof rawItem> | 'not-found' | 'server-error',
) => {
  const { apiClient } = await import('@/lib/api-client');
  const { ApiError } = await import('@/types/api');
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      return rawUser;
    }
    if (path === '/items/1') {
      if (item === 'not-found') {
        throw new ApiError('Item not found', 404);
      }
      if (item === 'server-error') {
        throw new ApiError('Server error', 500);
      }
      return item;
    }
    throw new Error(`Unexpected path: ${path}`);
  });
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  return apiClient;
};

const renderScreen = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/items/1']}>
        <Routes>
          <Route path="/items/:id" element={<ItemDetailScreen />} />
          <Route path="/items" element={<h1>Catálogo</h1>} />
          <Route path="/" element={<h1>Inicio</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('ItemDetailScreen', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the item fields and its collections', async () => {
    await mockApiClient(rawViewerUser, rawItem());

    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
    expect(screen.getByText('Una cámara de 35mm en buen estado.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Colecciones' })).toBeInTheDocument();
    expect(screen.getByText('Clásicos')).toBeInTheDocument();
  });

  it('shows a muted line instead of a state card when the item has no collections', async () => {
    await mockApiClient(rawViewerUser, rawItem({ collections: [] }));

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    expect(screen.getByText('Este artículo no pertenece a ninguna colección.')).toBeInTheDocument();
  });

  it('shows no action at all for a VIEWER', async () => {
    await mockApiClient(rawViewerUser, rawItem());

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('shows Edit for an EDITOR on an item they own', async () => {
    await mockApiClient(rawEditorUser, rawItem({ owner_id: 7 }));

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    const desktopActions = screen.getByRole('group', { name: 'Acciones del artículo' });
    expect(within(desktopActions).getByRole('link', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('does not show Edit for an EDITOR on an item owned by someone else', async () => {
    await mockApiClient(rawEditorUser, rawItem({ owner_id: 999 }));

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Acciones del artículo' })).not.toBeInTheDocument();
  });

  it('shows Edit and Delete for an ADMIN regardless of the owner', async () => {
    await mockApiClient(rawAdminUser, rawItem({ owner_id: 999 }));

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    const desktopActions = screen.getByRole('group', { name: 'Acciones del artículo' });
    expect(within(desktopActions).getByRole('link', { name: 'Editar' })).toBeInTheDocument();
    expect(within(desktopActions).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('opens the confirm dialog on Delete and only calls the API once confirmed', async () => {
    const user = userEvent.setup();
    const apiClient = await mockApiClient(rawAdminUser, rawItem());
    vi.mocked(apiClient.delete).mockResolvedValueOnce(null);

    renderScreen();

    await screen.findByRole('heading', { name: 'Cámara analógica' });
    const desktopActions = screen.getByRole('group', { name: 'Acciones del artículo' });
    await user.click(within(desktopActions).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(apiClient.delete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar artículo' }));

    await screen.findByRole('heading', { name: 'Catálogo' });
    expect(apiClient.delete).toHaveBeenCalledWith('/items/1');
  });

  it('shows the 404 state for an item that does not exist', async () => {
    await mockApiClient(rawViewerUser, 'not-found');

    renderScreen();

    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
  });

  it('shows the server error state for a 500, and retries on demand', async () => {
    await mockApiClient(rawViewerUser, 'server-error');

    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Error del servidor' })).toBeInTheDocument();
  });
});
