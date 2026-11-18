import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { MobileAccountDrawer } from './MobileAccountDrawer';

const rawUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'viewer' };

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

const renderDrawer = (onClose = vi.fn(), open = true) => {
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<MobileAccountDrawer open={open} onClose={onClose} />} />
          <Route path="/items" element={<h1>Catálogo</h1>} />
          <Route path="/colecciones" element={<h1>Colecciones</h1>} />
          <Route path="/login" element={<h1>Log in</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  return onClose;
};

const originalMatchMedia = window.matchMedia;

describe('MobileAccountDrawer', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing while closed', async () => {
    renderDrawer(vi.fn(), false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the profile block and the Cuenta, Colecciones and Desarrollo groups', async () => {
    renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' });
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(dialog).getByText('ada@example.com')).toBeInTheDocument();

    const cuenta = within(dialog).getByRole('group', { name: 'Cuenta' });
    expect(within(cuenta).getByRole('link', { name: /Mis items/ })).toHaveAttribute(
      'href',
      '/items?mine=true',
    );
    const colecciones = within(dialog).getByRole('group', { name: 'Colecciones' });
    expect(within(colecciones).getByRole('link', { name: /Ver colecciones/ })).toHaveAttribute(
      'href',
      '/colecciones',
    );
    const desarrollo = within(dialog).getByRole('group', { name: 'Desarrollo' });
    expect(within(desarrollo).getByRole('link', { name: /Componentes UI/ })).toHaveAttribute(
      'href',
      '/components-ui',
    );
  });

  it('renders the sections without a route as inactive entries, not links', async () => {
    renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'Cuenta' });
    ['Mensajes', 'Ajustes', 'Editar perfil', 'Colecciones destacadas'].forEach((label) => {
      expect(within(dialog).queryByRole('link', { name: new RegExp(label) })).toBeNull();
      expect(within(dialog).getByText(label).closest('[aria-disabled="true"]')).toHaveTextContent(
        'Próximamente',
      );
    });
  });

  it('closes the panel and navigates when a link is followed', async () => {
    const user = userEvent.setup();
    const onClose = renderDrawer();

    await user.click(await screen.findByRole('link', { name: /Ver colecciones/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Colecciones' })).toBeInTheDocument();
  });

  it('closes from the close button and on Escape', async () => {
    const user = userEvent.setup();
    const onClose = renderDrawer();

    await user.click(await screen.findByRole('button', { name: 'Cerrar' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when the viewport widens to the desktop breakpoint, and stops listening after', async () => {
    const listeners = new Set<() => void>();
    const query = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: () => void) =>
        listeners.delete(listener),
      ),
    };
    window.matchMedia = vi.fn(() => query as unknown as MediaQueryList);

    const onClose = renderDrawer();
    await screen.findByRole('dialog', { name: 'Cuenta' });
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    expect(onClose).not.toHaveBeenCalled();

    query.matches = true;
    act(() => listeners.forEach((listener) => listener()));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes the breakpoint listener when it unmounts', async () => {
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn(
      () =>
        ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener,
        }) as unknown as MediaQueryList,
    );

    renderDrawer();
    await screen.findByRole('dialog', { name: 'Cuenta' });
    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('logs out, closes the panel and redirects to /login', async () => {
    const user = userEvent.setup();
    const onClose = renderDrawer();

    await user.click(await screen.findByRole('button', { name: /Cerrar sesión/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem('auth-token')).toBeNull();
  });
});
