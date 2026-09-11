import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import HomePage from './HomePage';

const rawEditorUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'editor' };
const rawViewerUser = { id: 2, email: 'bob@example.com', name: 'Bob Smith', role: 'viewer' };

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
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthProvider>,
  );

describe('HomePage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('greets the logged-in user by name', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawEditorUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHomePage();

    expect(await screen.findByRole('heading', { name: 'Hola, Ada Lovelace' })).toBeInTheDocument();
  });

  it('greets a different logged-in user by their own name', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawViewerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderHomePage();

    expect(await screen.findByRole('heading', { name: 'Hola, Bob Smith' })).toBeInTheDocument();
  });

  it('shows a generic welcome heading before the session is known', () => {
    renderHomePage();

    expect(screen.getByRole('heading', { name: 'Hola' })).toBeInTheDocument();
  });

  it('links to the catalogue', () => {
    renderHomePage();

    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).toHaveAttribute(
      'href',
      '/items',
    );
  });
});
