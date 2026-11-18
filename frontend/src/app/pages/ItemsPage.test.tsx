import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import ItemsPage from './ItemsPage';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(async (path: string) =>
      path === '/auth/me'
        ? { id: 7, email: 'ada@example.com', name: 'Ada', role: 'viewer' }
        : { items: [], total: 0, page: 1, page_size: 20 },
    ),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

const renderPage = (entry: string) => {
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Link to="/?mine=true">Mis items</Link>
        <Link to="/">Todo</Link>
        <ItemsPage />
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe('ItemsPage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the whole catalogue without the mine parameter', async () => {
    const { apiClient } = await import('@/lib/api-client');

    renderPage('/');

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/items?page=1&page_size=20');
  });

  it('shows the owner view with mine=true', async () => {
    const { apiClient } = await import('@/lib/api-client');

    renderPage('/?mine=true');

    expect(await screen.findByRole('heading', { name: 'Mis items' })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/items/search?owner_id=7&page=1&page_size=20'),
    );
  });

  it('starts the other view from scratch when switching, instead of leaking the search', async () => {
    const user = userEvent.setup();

    renderPage('/?mine=true');
    const search = await screen.findByRole('searchbox', { name: 'Buscar en el catálogo' });
    await user.type(search, 'cámara');
    expect(search).toHaveValue('cámara');

    await user.click(screen.getByRole('link', { name: 'Todo' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' })).toHaveValue('');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' }), 'radio');
    await user.click(screen.getByRole('link', { name: 'Mis items' }));

    expect(await screen.findByRole('heading', { name: 'Mis items' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' })).toHaveValue('');
  });
});
