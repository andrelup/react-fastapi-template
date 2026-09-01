import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/features/auth';
import { SellerDashboard } from './SellerDashboard';

const rawSellerUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'seller' };

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

const renderSellerDashboard = () =>
  render(
    <AuthProvider>
      <SellerDashboard />
    </AuthProvider>,
  );

describe('SellerDashboard', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the dashboard heading and metrics overview', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderSellerDashboard();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    expect(screen.getByText('Libros publicados')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Ventas del mes')).toBeInTheDocument();
    expect(screen.getByText('€248')).toBeInTheDocument();
    expect(screen.getByText('Pedidos pendientes')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the recent activity list with status pills', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderSellerDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Actividad reciente' }),
    ).toBeInTheDocument();
    expect(screen.getByText('El nombre de la rosa')).toBeInTheDocument();
    expect(screen.getByText('Cien años de soledad')).toBeInTheDocument();
    expect(screen.getByText('Vendido')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });
});
