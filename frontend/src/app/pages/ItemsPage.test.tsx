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

  it('shows the owner view with mine=true and switches back without leaking state', async () => {
    const user = userEvent.setup();
    const { apiClient } = await import('@/lib/api-client');

    renderPage('/?mine=true');

    expect(await screen.findByRole('heading', { name: 'Mis items' })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/items/search?owner_id=7&page=1&page_size=20'),
    );

    await user.click(screen.getByRole('link', { name: 'Todo' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
  });
});
