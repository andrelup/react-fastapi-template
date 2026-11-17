import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, RoleRoute } from '@/features/auth';
import { ApiError } from '@/types/api';
import { CollectionFormScreen } from './CollectionFormScreen';

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

type RawRecord = Record<string, unknown>;

const rawAdmin = { id: 9, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const rawEditor = { id: 7, email: 'ada@example.com', name: 'Ada', role: 'editor' };
const rawViewer = { id: 3, email: 'bob@example.com', name: 'Bob', role: 'viewer' };

const rawCollection = (overrides: RawRecord = {}): RawRecord => ({
  id: 1,
  name: 'Clásicos',
  description: 'Los imprescindibles.',
  version: 1,
  items: [],
  ...overrides,
});

interface Backend {
  collections: Record<number, RawRecord>;
  onPost: (path: string, body: RawRecord) => RawRecord | Promise<RawRecord>;
  onPut: (path: string, body: RawRecord) => RawRecord | Promise<RawRecord>;
}

/** One implementation keyed on method + path, shared by every caller. */
const mockBackend = async (rawUser: RawRecord, overrides: Partial<Backend> = {}) => {
  const { apiClient } = await import('@/lib/api-client');
  const backend: Backend = {
    collections: { 1: rawCollection() },
    onPost: () => {
      throw new Error('Unexpected POST');
    },
    onPut: () => {
      throw new Error('Unexpected PUT');
    },
    ...overrides,
  };

  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === '/auth/me') {
      return rawUser;
    }
    const match = /^\/collections\/(\d+)$/.exec(path);
    if (match) {
      const found = backend.collections[Number(match[1])];
      if (found === undefined) {
        throw new ApiError('Collection not found', 404);
      }
      return found;
    }
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.mocked(apiClient.post).mockImplementation(async (path: string, body?: unknown) =>
    backend.onPost(path, body as RawRecord),
  );
  vi.mocked(apiClient.put).mockImplementation(async (path: string, body?: unknown) =>
    backend.onPut(path, body as RawRecord),
  );
  window.localStorage.setItem('auth-token', JSON.stringify('test-token'));
  return { apiClient, backend };
};

const LocationProbe = () => <output aria-label="ubicación">{useLocation().pathname}</output>;

const renderAt = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/colecciones/nueva"
            element={
              <RoleRoute allow={['admin']}>
                <CollectionFormScreen />
              </RoleRoute>
            }
          />
          <Route
            path="/colecciones/:id/editar"
            element={
              <RoleRoute allow={['admin']}>
                <CollectionFormScreen />
              </RoleRoute>
            }
          />
          <Route path="/colecciones/:id" element={<h1>Detalle de la colección</h1>} />
          <Route path="/colecciones" element={<h1>Colecciones</h1>} />
          <Route path="/" element={<h1>Inicio</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('CollectionFormScreen', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('creating', () => {
    it('lets an admin create a collection and goes to its detail', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin, {
        onPost: (_path, body) => ({ ...body, id: 5, version: 1 }),
      });

      renderAt('/colecciones/nueva');
      await user.type(await screen.findByLabelText('Nombre'), '  Novedades ');
      await user.type(screen.getByLabelText('Descripción'), 'Lo último');
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      expect(
        await screen.findByRole('heading', { name: 'Detalle de la colección' }),
      ).toBeInTheDocument();
      expect(apiClient.post).toHaveBeenCalledWith('/collections', {
        name: 'Novedades',
        description: 'Lo último',
      });
      expect(screen.getByLabelText('ubicación').textContent).toBe('/colecciones/5');
    });

    it('sends a blank description as null', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin, {
        onPost: (_path, body) => ({ ...body, id: 5, version: 1 }),
      });

      renderAt('/colecciones/nueva');
      await user.type(await screen.findByLabelText('Nombre'), 'Novedades');
      await user.type(screen.getByLabelText('Descripción'), '   ');
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      await screen.findByRole('heading', { name: 'Detalle de la colección' });
      expect(apiClient.post).toHaveBeenCalledWith('/collections', {
        name: 'Novedades',
        description: null,
      });
    });

    it('cancels back to the list', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin);

      renderAt('/colecciones/nueva');
      await user.click(await screen.findByRole('link', { name: 'Cancelar' }));

      expect(await screen.findByRole('heading', { name: 'Colecciones' })).toBeInTheDocument();
    });

    it('rejects an empty name without calling the API', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin);

      renderAt('/colecciones/nueva');
      await screen.findByLabelText('Nombre');
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('rejects a name over 200 characters without calling the API', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin);

      renderAt('/colecciones/nueva');
      await user.click(await screen.findByLabelText('Nombre'));
      await user.paste('a'.repeat(201));
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      expect(
        await screen.findByText('El nombre no puede superar los 200 caracteres'),
      ).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('shows the name-taken error on the field after a 409', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin, {
        onPost: () => {
          throw new ApiError('Conflict', 409);
        },
      });

      renderAt('/colecciones/nueva');
      await user.type(await screen.findByLabelText('Nombre'), 'Clásicos');
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      expect(await screen.findByText('Ya existe una colección con ese nombre')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows other errors in a form-level alert', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin, {
        onPost: () => {
          throw new ApiError('Boom del servidor', 500);
        },
      });

      renderAt('/colecciones/nueva');
      await user.type(await screen.findByLabelText('Nombre'), 'Clásicos');
      await user.click(screen.getByRole('button', { name: 'Crear colección' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Boom del servidor');
    });
  });

  describe('editing', () => {
    it('prefills the form, sends the version and goes back to the detail', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin, {
        onPut: (_path, body) => ({ ...rawCollection(), ...body, version: 2 }),
      });

      renderAt('/colecciones/1/editar');
      const name = await screen.findByLabelText('Nombre');
      expect(name).toHaveValue('Clásicos');
      expect(screen.getByLabelText('Descripción')).toHaveValue('Los imprescindibles.');

      await user.clear(name);
      await user.type(name, 'Clásicos 2');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(
        await screen.findByRole('heading', { name: 'Detalle de la colección' }),
      ).toBeInTheDocument();
      expect(apiClient.put).toHaveBeenCalledWith('/collections/1', {
        name: 'Clásicos 2',
        description: 'Los imprescindibles.',
        version: 1,
      });
      expect(screen.getByLabelText('ubicación').textContent).toBe('/colecciones/1');
    });

    it('cancels back to the detail', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin);

      renderAt('/colecciones/1/editar');
      await user.click(await screen.findByRole('link', { name: 'Cancelar' }));

      expect(
        await screen.findByRole('heading', { name: 'Detalle de la colección' }),
      ).toBeInTheDocument();
    });

    it('offers to reload when a 409 comes from a newer version, then resubmits it', async () => {
      const user = userEvent.setup();
      const { apiClient, backend } = await mockBackend(rawAdmin, {
        onPut: (_path, body) => {
          if (body.version === 1) {
            throw new ApiError('Conflict', 409);
          }
          return { ...rawCollection(), ...body, version: 3 };
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');
      // Someone else saves after the form loaded.
      backend.collections[1] = rawCollection({ name: 'Renombrada', version: 2 });
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Alguien ha modificado esta colección');
      expect(screen.queryByText('Ya existe una colección con ese nombre')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cargar la última versión' }));
      expect(await screen.findByDisplayValue('Renombrada')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await screen.findByRole('heading', { name: 'Detalle de la colección' });
      expect(apiClient.put).toHaveBeenLastCalledWith(
        '/collections/1',
        expect.objectContaining({ name: 'Renombrada', version: 2 }),
      );
    });

    it('shows the name-taken error when a rename 409s with the same version', async () => {
      const user = userEvent.setup();
      // The backend only checks the name when it changes, so the 409 needs a
      // rename onto another collection's name.
      await mockBackend(rawAdmin, {
        collections: { 1: rawCollection(), 2: rawCollection({ id: 2, name: 'Favoritos' }) },
        onPut: (_path, body) => {
          if (body.name === 'Favoritos') {
            throw new ApiError('Conflict', 409);
          }
          return { ...rawCollection(), ...body, version: 2 };
        },
      });

      renderAt('/colecciones/1/editar');
      const name = await screen.findByLabelText('Nombre');
      await user.clear(name);
      await user.type(name, 'Favoritos');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByText('Ya existe una colección con ese nombre')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says the collection is gone when the save 404s, and blocks saving again', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin, {
        onPut: () => {
          throw new ApiError('Collection 1 not found', 404);
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Esta colección ya no existe');
      expect(screen.queryByText('Collection 1 not found')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

      await user.click(screen.getByRole('link', { name: 'Volver a las colecciones' }));
      expect(await screen.findByRole('heading', { name: 'Colecciones' })).toBeInTheDocument();
    });

    it('says the collection is gone when the re-fetch after a 409 finds it deleted', async () => {
      const user = userEvent.setup();
      const { backend } = await mockBackend(rawAdmin, {
        onPut: () => {
          throw new ApiError('Conflict', 409);
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');
      // Someone deletes it after the form loaded.
      delete backend.collections[1];
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Esta colección ya no existe');
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('shows a Spanish permission error when the save 403s', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin, {
        onPut: () => {
          throw new ApiError('You do not have permission to perform this action', 403);
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No tienes permiso para crear ni editar colecciones.',
      );
      expect(screen.queryByText(/permission/)).not.toBeInTheDocument();
    });

    it('shows other errors in a form-level alert', async () => {
      const user = userEvent.setup();
      await mockBackend(rawAdmin, {
        onPut: () => {
          throw new ApiError('Boom del servidor', 500);
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Boom del servidor');
    });

    it('offers a retry when the collection fails to load', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin);
      const impl = vi.mocked(apiClient.get).getMockImplementation();
      let failing = true;
      vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
        if (path === '/collections/1' && failing) {
          throw new ApiError('x', 500);
        }
        return impl!(path);
      });

      renderAt('/colecciones/1/editar');
      expect(
        await screen.findByRole('heading', { name: 'Error del servidor' }),
      ).toBeInTheDocument();

      failing = false;
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByLabelText('Nombre')).toHaveValue('Clásicos');
    });

    it('shows a form-level alert when the re-fetch after a 409 fails', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin, {
        onPut: () => {
          throw new ApiError('Conflict', 409);
        },
      });

      renderAt('/colecciones/1/editar');
      await user.type(await screen.findByLabelText('Descripción'), ' Extra');

      const impl = vi.mocked(apiClient.get).getMockImplementation();
      vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
        if (path === '/collections/1') {
          throw new ApiError('Refetch roto', 500);
        }
        return impl!(path);
      });
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Refetch roto');
      expect(screen.queryByText('Ya existe una colección con ese nombre')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cargar la última versión' })).toBeNull();
    });

    it('shows the not-found screen for a missing collection', async () => {
      await mockBackend(rawAdmin, { collections: {} });

      renderAt('/colecciones/99/editar');

      expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
      expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    });
  });

  describe.each([
    ['editor', rawEditor],
    ['viewer', rawViewer],
  ])('as a %s', (_role, rawUser) => {
    it.each(['/colecciones/nueva', '/colecciones/1/editar'])(
      'gets the not-found screen at %s without the URL changing',
      async (path) => {
        await mockBackend(rawUser);

        renderAt(path);

        expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
        expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
        expect(screen.getByLabelText('ubicación').textContent).toBe(path);
      },
    );
  });
});
