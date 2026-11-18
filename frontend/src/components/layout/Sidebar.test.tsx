import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { Layout } from './Layout';
import { Sidebar } from './Sidebar';

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

describe('Sidebar', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the user's name and initials when there is a session", async () => {
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

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('logs the user out and redirects to /login when the logout button is clicked', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Sidebar />} />
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

  it('shows the main navigation entries', async () => {
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

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver colecciones' })).toHaveAttribute(
      'href',
      '/colecciones',
    );
    expect(screen.getByText('Colecciones destacadas')).toBeInTheDocument();
  });

  const renderAt = async (entry: string) => {
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Sidebar />
        </MemoryRouter>
      </AuthProvider>,
    );
    await screen.findByText('Ada Lovelace');
  };

  it('offers "Mis items" as a link to the owner view of the catalogue', async () => {
    await renderAt('/');

    expect(screen.getByRole('link', { name: 'Mis items' })).toHaveAttribute(
      'href',
      '/items?mine=true',
    );
  });

  it('marks only "Explorar catálogo" on the catalogue and on an item', async () => {
    await renderAt('/items/3');

    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Mis items' })).not.toHaveAttribute('aria-current');
  });

  it('marks only "Mis items" on the owner view', async () => {
    await renderAt('/items?mine=true');

    expect(screen.getByRole('link', { name: 'Mis items' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the «Próximamente» pill on every inactive entry, with no unread badge', async () => {
    await renderAt('/');

    expect(screen.getAllByText('Próximamente')).toHaveLength(3);
    expect(screen.getByText('Mensajes').closest('[aria-disabled="true"]')).toHaveTextContent(
      'MensajesPróximamente',
    );
  });

  it('matches paths case-insensitively, as the router does', async () => {
    await renderAt('/Items');

    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('groups the entries under accessible headings', async () => {
    await renderAt('/');

    ['Principal', 'Colecciones', 'Cuenta', 'Desarrollo'].forEach((name) =>
      expect(screen.getByRole('group', { name })).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('group', { name: 'Cuenta' })).getByRole('link', {
        name: 'Mis items',
      }),
    ).toBeInTheDocument();
  });

  it('treats a trailing slash like the plain path', async () => {
    await renderAt('/items/?mine=true');

    expect(screen.getByRole('link', { name: 'Mis items' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).not.toHaveAttribute(
      'aria-current',
    );
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
