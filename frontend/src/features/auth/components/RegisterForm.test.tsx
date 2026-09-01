import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { AuthProvider } from './AuthProvider';
import { RegisterForm } from './RegisterForm';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(async () => ({
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      role: 'customer',
    })),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

const renderRegisterForm = () => {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/login" element={<h1>Login content</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
};

describe('RegisterForm', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the password requirements at all times', () => {
    renderRegisterForm();

    expect(screen.getByText('Mínimo 8 caracteres (máximo 128)')).toBeInTheDocument();
  });

  it('does not call the API and shows an error when the password is too short', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText('Nombre'), 'Test User');
    await user.type(screen.getByLabelText('Correo electrónico'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'short');
    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(
      await screen.findByText('La contraseña debe tener entre 8 y 128 caracteres'),
    ).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByText('Mínimo 8 caracteres (máximo 128)')).toBeInTheDocument();
  });

  it('does not call the API and shows an error when the email is empty or malformed', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText('Nombre'), 'Test User');
    await user.type(screen.getByLabelText('Correo electrónico'), 'not-an-email');
    await user.type(screen.getByLabelText('Contraseña'), 'valid-password');
    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(await screen.findByText('Introduce un email válido')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('registers and redirects to /login when email and password are valid', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText('Nombre'), 'Test User');
    await user.type(screen.getByLabelText('Correo electrónico'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'valid-password');
    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'user@example.com',
        name: 'Test User',
        password: 'valid-password',
        role: 'customer',
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Login content' })).toBeInTheDocument();
    });
  });
});
