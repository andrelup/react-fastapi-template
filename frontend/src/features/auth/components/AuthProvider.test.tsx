import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

const rawAdminUser = { id: 1, email: 'ada@example.com', name: 'Ada Lovelace', role: 'admin' };
const rawEditorUser = { id: 2, email: 'bob@example.com', name: 'Bob Smith', role: 'editor' };

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

interface RoleProbeProps {
  minimum: UserRole;
}

/** Renders the rehydrated user's name and the result of `hasRole(minimum)`. */
const RoleProbe = ({ minimum }: RoleProbeProps) => {
  const { user, hasRole } = useAuth();
  return (
    <div>
      <p>{user ? user.name : 'no user'}</p>
      <p>{hasRole(minimum) ? 'allowed' : 'denied'}</p>
    </div>
  );
};

const renderProbe = (minimum: UserRole) =>
  render(
    <AuthProvider>
      <RoleProbe minimum={minimum} />
    </AuthProvider>,
  );

describe('AuthProvider hasRole', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns false when there is no authenticated user', () => {
    renderProbe('viewer');

    expect(screen.getByText('no user')).toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('lets an admin satisfy a lower minimum', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawAdminUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderProbe('editor');

    await screen.findByText(rawAdminUser.name);
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('does not let an editor satisfy the admin minimum', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawEditorUser);
    window.localStorage.setItem('auth-token', JSON.stringify('test-token'));

    renderProbe('admin');

    await screen.findByText(rawEditorUser.name);
    expect(screen.getByText('denied')).toBeInTheDocument();
  });
});
