import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { Header } from './Header';

const rawUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'viewer' };

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
          element.textContent === 'MiApp' &&
          element.className.includes('font-serif'),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar')).not.toBeInTheDocument();
  });

  it('shows the search input for a logged-in user', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHeader();

    expect(await screen.findByLabelText('Buscar')).toBeInTheDocument();
  });
});
