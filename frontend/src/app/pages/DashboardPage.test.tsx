import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/features/auth';
import DashboardPage from './DashboardPage';

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

const renderDashboardPage = () =>
  render(
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>,
  );

describe('DashboardPage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the seller dashboard', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderDashboardPage();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
