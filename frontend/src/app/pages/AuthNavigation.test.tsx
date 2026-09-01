import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

describe('auth pages navigation', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('navigates between the login and register pages via their links', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Regístrate' }));

    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Inicia sesión' }));

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
