import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
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

// The tests below that open the panel and press keys use `userEvent`, which
// honours the modal's `pointer-events: none` like a real user would. The
// older ones keep `fireEvent`, the documented exception in
// docs/frontend-testing.md.
describe('MobileTabBar', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when there is no session', () => {
    const { container } = renderTabBar();

    expect(container).toBeEmptyDOMElement();
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

  it('returns focus to the tab after the close button, but not after following a link', async () => {
    const user = userEvent.setup();
    await login();
    renderTabBar();

    const accountTab = await screen.findByRole('button', { name: /Cuenta/ });
    await user.click(accountTab);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(accountTab).toHaveFocus());

    await user.click(accountTab);
    await user.click(screen.getByRole('link', { name: /Ver colecciones/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Radix restores focus on a timer: give it the chance to (wrongly) fire.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(accountTab).not.toHaveFocus();
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
    const user = userEvent.setup();
    await login();
    const router = createMemoryRouter([{ path: '*', element: <MobileTabBar /> }], {
      initialEntries: ['/', '/items'],
      initialIndex: 1,
    });
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Cuenta/ }));
    expect(screen.getByRole('dialog', { name: 'Cuenta' })).toBeInTheDocument();

    await act(async () => {
      await router.navigate(-1);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Going Forward must not bring the panel back.
    await act(async () => {
      await router.navigate(1);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
