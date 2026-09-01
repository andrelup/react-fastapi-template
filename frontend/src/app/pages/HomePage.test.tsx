import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/features/auth';
import HomePage from './HomePage';

const rawSellerUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'seller' };
const rawCustomerUser = { id: 2, email: 'bob@example.com', name: 'Bob Smith', role: 'customer' };

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

const renderHomePage = () =>
  render(
    <AuthProvider>
      <HomePage />
    </AuthProvider>,
  );

describe('HomePage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a welcome message and both CTAs for a seller', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHomePage();

    expect(
      await screen.findByRole('heading', { name: 'Bienvenida, Ada Lovelace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar un libro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explorar catálogo' })).toBeInTheDocument();
  });

  it('shows a welcome message and only the catalog CTA for a customer', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawCustomerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHomePage();

    expect(await screen.findByRole('heading', { name: /Bienvenida a BookShelf/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explorar catálogo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar un libro' })).not.toBeInTheDocument();
  });

  it('renders the placeholder CTAs as disabled', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHomePage();

    expect(await screen.findByRole('button', { name: 'Publicar un libro' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Explorar catálogo' })).toBeDisabled();
  });
});
