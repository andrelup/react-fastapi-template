import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { MobileTabBar } from './MobileTabBar';

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

const renderTabBar = (initialEntries: string[] = ['/']) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <MobileTabBar />
      </MemoryRouter>
    </AuthProvider>,
  );

const login = async () => {
  const { apiClient } = await import('@/lib/api-client');
  vi.mocked(apiClient.get).mockResolvedValueOnce(rawUser);
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
};

describe('MobileTabBar', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when there is no session', () => {
    const { container } = renderTabBar();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Inicio and Cuenta tabs once logged in', async () => {
    await login();

    renderTabBar();

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Cuenta')).toBeInTheDocument();
  });

  it('marks the "Inicio" tab as active on the home route', async () => {
    await login();

    renderTabBar(['/']);

    const inicioLabel = await screen.findByText('Inicio');
    const inicioLink = inicioLabel.closest('a');

    expect(inicioLink).toHaveAttribute('aria-current', 'page');
  });

  it('opens the account drawer with the account options when "Cuenta" is tapped', async () => {
    await login();

    renderTabBar();

    const accountTab = await screen.findByRole('button', { name: /Cuenta/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(accountTab);

    const dialog = screen.getByRole('dialog', { name: 'Cuenta' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Editar perfil')).toBeInTheDocument();
    expect(screen.getByText('Mensajes')).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument();
  });

  it('closes the account drawer with the close button', async () => {
    await login();

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));
    expect(screen.getByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
