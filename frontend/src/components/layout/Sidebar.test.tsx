import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { Layout } from './Layout';
import { Sidebar } from './Sidebar';

const rawUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'customer' };
const rawSellerUser = { id: 2, email: 'bob@example.com', name: 'Bob Smith', role: 'seller' };

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(async () => rawUser),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

describe('Sidebar', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the user's name and initials when there is a session", async () => {
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<Sidebar />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('logs the user out and redirects to /login when the logout button is clicked', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<Sidebar />} />
            <Route path="/login" element={<h1>Log in</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem('auth-token')).toBeNull();
  });

  it('hides the seller-only "Dashboard" link for a customer', async () => {
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Sidebar />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await screen.findByText('Ada Lovelace');

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
  });

  it('shows the "Dashboard" link for a seller', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawSellerUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Sidebar />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await screen.findByText('Bob Smith');

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('is not rendered when there is no session', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<h1>Log in</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
