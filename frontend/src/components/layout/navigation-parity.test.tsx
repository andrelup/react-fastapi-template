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

interface Entries {
  /** href → visible text of each link. */
  links: Map<string, string>;
  /** Visible text of each inactive entry. */
  inactive: string[];
}

const labelOf = (el: Element) =>
  Array.from(el.querySelectorAll('span')).find((span) => span.textContent)?.textContent ?? '';

/** Every link and every inactive entry (`aria-disabled`) inside `roots`. */
const collectEntries = (...roots: HTMLElement[]): Entries => ({
  links: new Map(
    roots.flatMap((root) =>
      Array.from(root.querySelectorAll('a[href]')).map((a): [string, string] => [
        a.getAttribute('href') ?? '',
        a.textContent?.trim() ?? '',
      ]),
    ),
  ),
  inactive: roots.flatMap((root) =>
    Array.from(root.querySelectorAll('[aria-disabled="true"]')).map(labelOf),
  ),
});

// The issue's acceptance criterion: adding a Sidebar entry without a mobile
// counterpart must break the suite. The navigation config makes that hard to
// do by accident, and this keeps it true if either surface stops rendering from it.
describe('desktop and mobile navigation parity', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('reaches every Sidebar section from the mobile navigation, as the same kind of entry', async () => {
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
    const mobile = collectEntries(
      screen.getByRole('navigation', { name: 'Navegación móvil', hidden: true }),
      screen.getByRole('dialog', { name: 'Cuenta' }),
    );

    // Sanity: the collection is not vacuous.
    expect(sidebar.links.size).toBeGreaterThanOrEqual(5);
    expect(sidebar.inactive.length).toBeGreaterThanOrEqual(3);

    // Every Sidebar link is a link on mobile, with the same href…
    sidebar.links.forEach((_label, href) => expect(mobile.links.has(href)).toBe(true));
    // …and every inactive Sidebar entry is inactive on mobile, not a link.
    const mobileLinkLabels = Array.from(mobile.links.values());
    sidebar.inactive.forEach((label) => {
      expect(mobile.inactive).toContain(label);
      expect(mobileLinkLabels.some((text) => text.includes(label))).toBe(false);
    });

    // No mobile entry is both a link and inactive.
    mobile.inactive.forEach((label) => {
      expect(mobileLinkLabels.some((text) => text.includes(label))).toBe(false);
    });
  });
});
