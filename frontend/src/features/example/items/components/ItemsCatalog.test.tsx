import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  slug: 'camara-analogica',
  description: 'Una cámara de 35mm en buen estado.',
  category: 'electronica',
  tags: ['vintage'],
  owner_id: 7,
  version: 1,
  ...overrides,
});

const renderCatalog = () => render(<ItemsCatalog />);

describe('ItemsCatalog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists the items returned by the raw paginated response', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawItem(), rawItem({ id: 2, name: 'Tocadiscos vintage', slug: 'tocadiscos' })],
      total: 2,
      page: 1,
      page_size: 20,
    });

    renderCatalog();

    expect(await screen.findByRole('heading', { name: 'Cámara analógica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tocadiscos vintage' })).toBeInTheDocument();
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
      items: [rawItem({ id: 3, name: 'Máquina de escribir', slug: 'maquina-escribir' })],
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
      items: [rawItem({ id: 9, name: 'Radio de válvulas', slug: 'radio-valvulas' })],
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
});
