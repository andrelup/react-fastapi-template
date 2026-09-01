import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { LoginForm } from './LoginForm';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(async () => ({
      access_token: 'test-access-token',
      token_type: 'bearer',
      user: { id: 1, email: 'user@example.com', name: 'Test User', role: 'customer' },
    })),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

describe('LoginForm', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects to the originally requested destination after a successful login', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { from: { pathname: '/dashboard' } } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/dashboard" element={<h1>Dashboard content</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText('Correo electrónico'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'super-secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument();
    });
  });

  it('redirects to / when there was no originally requested destination', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/" element={<h1>Home content</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await user.type(screen.getByLabelText('Correo electrónico'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'super-secret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Home content' })).toBeInTheDocument();
    });
  });
});
