import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { MobileTabBar } from './MobileTabBar';
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

/** Every link (by href) and every inactive entry (by label) inside `root`. */
const collectEntries = (root: HTMLElement) => ({
  hrefs: Array.from(root.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
  inactive: Array.from(root.querySelectorAll('[aria-disabled="true"]')).map(
    (el) =>
      Array.from(el.querySelectorAll('span')).find((span) => span.textContent)?.textContent ?? '',
  ),
});

describe('desktop and mobile navigation parity', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('reaches from the mobile navigation every section the Sidebar offers, with the same kind', async () => {
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
          <MobileTabBar />
        </MemoryRouter>
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Cuenta/ }));

    const sidebar = collectEntries(screen.getByRole('complementary', { hidden: true }));
    const mobile = {
      hrefs: [
        ...collectEntries(
          screen.getByRole('navigation', { name: 'Navegación móvil', hidden: true }),
        ).hrefs,
        ...collectEntries(screen.getByRole('dialog', { name: 'Cuenta' })).hrefs,
      ],
      inactive: collectEntries(screen.getByRole('dialog', { name: 'Cuenta' })).inactive,
    };

    // Sanity: the collection is not vacuous.
    expect(sidebar.hrefs.length).toBeGreaterThanOrEqual(5);
    expect(sidebar.inactive.length).toBeGreaterThanOrEqual(3);

    sidebar.hrefs.forEach((href) => expect(mobile.hrefs).toContain(href));
    sidebar.inactive.forEach((label) => expect(mobile.inactive).toContain(label));

    // A section that is a link on the Sidebar is never an inactive entry on mobile.
    expect(mobile.inactive).not.toContain('Mis items');
  });
});
