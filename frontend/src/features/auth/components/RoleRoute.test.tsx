import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { RoleRoute } from './RoleRoute';

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

const loginAs = async (raw: typeof rawSellerUser | typeof rawCustomerUser) => {
  const { apiClient } = await import('@/lib/api-client');
  vi.mocked(apiClient.get).mockResolvedValueOnce(raw);
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
};

const renderDashboardRoute = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RoleRoute allow={['seller']}>
                <h1>Dashboard content</h1>
              </RoleRoute>
            }
          />
          <Route path="/login" element={<h1>Log in</h1>} />
          <Route path="/" element={<h1>Inicio</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('RoleRoute', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the route for an allowed role', async () => {
    await loginAs(rawSellerUser);

    renderDashboardRoute();

    expect(await screen.findByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument();
  });

  it('shows the 404 screen for a role that is not allowed', async () => {
    await loginAs(rawCustomerUser);

    renderDashboardRoute();

    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard content' })).not.toBeInTheDocument();
  });

  it('sends the rejected user back home from the 404 screen', async () => {
    const user = userEvent.setup();
    await loginAs(rawCustomerUser);

    renderDashboardRoute();
    await screen.findByText('Página no encontrada');

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
  });

  it('redirects to /login when there is no session, without leaking the 404', () => {
    renderDashboardRoute();

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText('Página no encontrada')).not.toBeInTheDocument();
  });

  it('waits with a spinner instead of flashing the 404 while the user is rehydrated', async () => {
    const { apiClient } = await import('@/lib/api-client');
    // Never resolves: reproduces the window after a refresh where the token is
    // already restored but the user has not come back from the API yet.
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderDashboardRoute();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Página no encontrada')).not.toBeInTheDocument();
  });
});
