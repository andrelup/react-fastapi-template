import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { Header } from './Header';

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

const renderHeader = () =>
  render(
    <AuthProvider>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </AuthProvider>,
  );

describe('Header', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows only the logo when there is no session', () => {
    renderHeader();

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === 'span' &&
          element.textContent === 'BookShelf' &&
          element.className.includes('font-serif'),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Vender libro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carrito/ })).not.toBeInTheDocument();
  });

  it('shows the search input and the "+ Vender libro" button for a seller', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHeader();

    expect(await screen.findByRole('button', { name: '+ Vender libro' })).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carrito/ })).not.toBeInTheDocument();
  });

  it('shows the cart button with its badge for a customer', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawCustomerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHeader();

    const cartButton = await screen.findByRole('button', { name: 'Carrito (3)' });
    expect(cartButton).toBeInTheDocument();
    expect(cartButton).toHaveTextContent('3');
    expect(screen.queryByRole('button', { name: '+ Vender libro' })).not.toBeInTheDocument();
  });
});
