import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { MobileTabBar } from './MobileTabBar';

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

const renderTabBar = (initialEntries: string[] = ['/']) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <MobileTabBar />
      </MemoryRouter>
    </AuthProvider>,
  );

const loginAs = async (raw: typeof rawSellerUser | typeof rawCustomerUser) => {
  const { apiClient } = await import('@/lib/api-client');
  vi.mocked(apiClient.get).mockResolvedValueOnce(raw);
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

  it('shows the simplified seller tabs (Inicio + FAB + Cuenta)', async () => {
    await loginAs(rawSellerUser);

    renderTabBar();

    expect(await screen.findByText('Añadir libro')).toBeInTheDocument();
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
    expect(screen.queryByText('Carrito')).not.toBeInTheDocument();
  });

  it('shows the simplified customer tabs (Inicio + Carrito + Cuenta), without the FAB', async () => {
    await loginAs(rawCustomerUser);

    renderTabBar();

    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Carrito')).toBeInTheDocument();
    expect(screen.getByText('Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Añadir libro')).not.toBeInTheDocument();
    expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
    expect(screen.queryByText('Favoritos')).not.toBeInTheDocument();
  });

  it('marks the "Inicio" tab as active on the home route', async () => {
    await loginAs(rawCustomerUser);

    renderTabBar(['/']);

    const inicioLabel = await screen.findByText('Inicio');
    const inicioLink = inicioLabel.closest('a');

    expect(inicioLink).toHaveAttribute('aria-current', 'page');
  });

  it('opens the account drawer with the customer options when "Cuenta" is tapped', async () => {
    await loginAs(rawCustomerUser);

    renderTabBar();

    const accountTab = await screen.findByRole('button', { name: /Cuenta/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(accountTab);

    const dialog = screen.getByRole('dialog', { name: 'Cuenta' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Mis favoritos')).toBeInTheDocument();
    expect(screen.getByText('Mis pedidos')).toBeInTheDocument();
    expect(screen.getByText('Editar perfil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument();
    // Customer has no "Mensajes (Próximamente)" entry.
    expect(screen.queryByText('Mensajes')).not.toBeInTheDocument();
  });

  it('opens the account drawer with the seller options (including Mensajes "Próximamente")', async () => {
    await loginAs(rawSellerUser);

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));

    expect(screen.getByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Editar perfil')).toBeInTheDocument();
    expect(screen.getByText('Mensajes')).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
    // Seller has no customer-only entries.
    expect(screen.queryByText('Mis favoritos')).not.toBeInTheDocument();
    expect(screen.queryByText('Mis pedidos')).not.toBeInTheDocument();
  });

  it('links to the dashboard from the seller account drawer', async () => {
    await loginAs(rawSellerUser);

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));

    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/dashboard');
  });

  it('hides the seller-only dashboard entry from a customer', async () => {
    await loginAs(rawCustomerUser);

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));

    expect(screen.queryByRole('link', { name: /Dashboard/ })).not.toBeInTheDocument();
  });

  it('marks the dashboard entry as active while on /dashboard', async () => {
    await loginAs(rawSellerUser);

    renderTabBar(['/dashboard']);

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));

    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
  });

  it('closes the account drawer when the dashboard entry is tapped', async () => {
    await loginAs(rawSellerUser);

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));
    fireEvent.click(screen.getByRole('link', { name: /Dashboard/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the account drawer with the close button', async () => {
    await loginAs(rawCustomerUser);

    renderTabBar();

    fireEvent.click(await screen.findByRole('button', { name: /Cuenta/ }));
    expect(screen.getByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
