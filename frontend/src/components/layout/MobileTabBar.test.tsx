import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
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

const BackButton = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Atrás</button>;
};

const renderTabBar = (initialEntries: string[] = ['/'], initialIndex?: number) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <BackButton />
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

    expect(container.querySelector('nav')).toBeNull();
  });

  it('shows the Inicio, Catálogo and Cuenta tabs once logged in', async () => {
    await login();

    renderTabBar();

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/items');
    expect(screen.getByText('Cuenta')).toBeInTheDocument();
  });

  it('marks "Catálogo" active on the catalogue and on an item, but not on "Mis items"', async () => {
    await login();
    const { unmount } = renderTabBar(['/items/5']);
    expect(await screen.findByRole('link', { name: 'Catálogo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    unmount();

    await login();
    const mine = renderTabBar(['/items?mine=true']);
    expect(await screen.findByRole('link', { name: 'Catálogo' })).not.toHaveAttribute(
      'aria-current',
    );
    mine.unmount();

    await login();
    renderTabBar(['/']);
    expect(await screen.findByRole('link', { name: 'Catálogo' })).not.toHaveAttribute(
      'aria-current',
    );
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
    expect(screen.getByRole('link', { name: /Mis items/ })).toHaveAttribute(
      'href',
      '/items?mine=true',
    );
    expect(screen.getByText('Editar perfil')).toBeInTheDocument();
    expect(screen.getByText('Mensajes')).toBeInTheDocument();
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

  it('moves focus into the open panel, closes on Escape and returns focus to the tab', async () => {
    const user = userEvent.setup();
    await login();
    renderTabBar();

    const accountTab = await screen.findByRole('button', { name: /Cuenta/ });
    await user.click(accountTab);

    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(accountTab).toHaveFocus());
  });

  it('keeps Tab inside the open panel', async () => {
    const user = userEvent.setup();
    await login();
    renderTabBar();

    await user.click(await screen.findByRole('button', { name: /Cuenta/ }));
    const dialog = screen.getByRole('dialog', { name: 'Cuenta' });

    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('closes the panel when the location changes, as with the browser Back button', async () => {
    await login();
    renderTabBar(['/', '/items'], 1);

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));
    expect(screen.getByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atrás', hidden: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
