import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RoleRoute } from '@/features/auth';
import { ApiError } from '@/types/api';
import { ItemFormScreen } from './ItemFormScreen';

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

const rawEditor = { id: 7, email: 'ada@example.com', name: 'Ada', role: 'editor' };
const rawAdmin = { id: 9, email: 'admin@example.com', name: 'Admin', role: 'admin' };
const rawViewer = { id: 3, email: 'bob@example.com', name: 'Bob', role: 'viewer' };

const rawItem = (overrides: RawRecord = {}): RawRecord => ({
  id: 1,
  name: 'Cámara analógica',
  slug: 'camara-analogica',
  description: 'Una cámara de 35mm.',
  category: 'electronica',
  tags: ['vintage'],
  owner_id: 7,
  version: 1,
  collections: [{ id: 1, name: 'Clásicos' }],
  ...overrides,
});

const rawCollections = {
  items: [
    { id: 1, name: 'Clásicos', description: null, version: 1 },
    { id: 2, name: 'Novedades', description: null, version: 1 },
  ],
  total: 2,
  page: 1,
  page_size: 100,
};

interface Backend {
  items: Record<number, RawRecord>;
  tags: { id: number; name: string }[];
  onPost: (path: string, body: RawRecord) => RawRecord | Promise<RawRecord>;
  onPut: (path: string, body: RawRecord) => RawRecord | Promise<RawRecord>;
}

/**
 * One implementation keyed on method + path: session rehydration (`/auth/me`),
 * the screen's own fetches and the form's calls all share the same mock, so
 * chained one-shot mocks would hand a response to the wrong caller.
 */
const mockBackend = async (rawUser: RawRecord, overrides: Partial<Backend> = {}) => {
  const { apiClient } = await import('@/lib/api-client');
  const backend: Backend = {
    items: { 1: rawItem() },
    tags: [{ id: 1, name: 'vintage' }],
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
    if (path.startsWith('/collections')) {
      return rawCollections;
    }
    if (path.startsWith('/tags')) {
      return { tags: backend.tags };
    }
    const match = /^\/items\/(\d+)$/.exec(path);
    if (match) {
      const found = backend.items[Number(match[1])];
      if (found === undefined) {
        throw new ApiError('Item not found', 404);
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

const renderAt = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/items/nuevo"
            element={
              <RoleRoute allow={['admin', 'editor']}>
                <ItemFormScreen />
              </RoleRoute>
            }
          />
          <Route
            path="/items/:id/editar"
            element={
              <RoleRoute allow={['admin', 'editor']}>
                <ItemFormScreen />
              </RoleRoute>
            }
          />
          <Route path="/items/:id" element={<h1>Detalle del item</h1>} />
          <Route path="/items" element={<h1>Catálogo</h1>} />
          <Route path="/" element={<h1>Inicio</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

const fillBasics = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText('Nombre'), 'Tocadiscos');
  await user.type(screen.getByLabelText('Slug'), 'tocadiscos');
};

const putCalls = (apiClient: { put: unknown }) =>
  vi.mocked(apiClient.put as (path: string, body?: unknown) => Promise<unknown>).mock.calls;

describe('ItemFormScreen', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('creating', () => {
    it('lets an editor create an item and sends the full payload', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPost: (_path, body) => ({ ...rawItem(), ...body, id: 5, version: 1 }),
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.type(screen.getByLabelText('Descripción'), 'Con brazo de carbono');
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      expect(await screen.findByRole('heading', { name: 'Detalle del item' })).toBeInTheDocument();
      expect(apiClient.post).toHaveBeenCalledWith('/items', {
        name: 'Tocadiscos',
        slug: 'tocadiscos',
        description: 'Con brazo de carbono',
        category: null,
        tags: [],
      });
      expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('sends a chosen existing tag without creating it', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPost: (_path, body) => ({ ...rawItem(), ...body, id: 5 }),
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));
      await user.click(await screen.findByRole('option', { name: 'vintage' }));
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/items',
        expect.objectContaining({ tags: ['vintage'] }),
      );
    });

    it('creates a tag that did not exist and sends its name', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPost: (path, body) =>
          path === '/tags' ? { id: 40, name: body.name } : { ...rawItem(), ...body, id: 5 },
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.type(screen.getByRole('combobox', { name: 'Etiquetas' }), 'retro');
      await user.click(await screen.findByRole('option', { name: /Crear «retro»/ }));
      await screen.findByRole('button', { name: 'Quitar retro' });
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(apiClient.post).toHaveBeenCalledWith('/tags', { name: 'retro' });
      expect(apiClient.post).toHaveBeenCalledWith(
        '/items',
        expect.objectContaining({ tags: ['retro'] }),
      );
    });

    it('does not send a tag whose creation failed', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPost: (path, body) => {
          if (path === '/tags') {
            throw new ApiError('Server error', 500);
          }
          return { ...rawItem(), ...body, id: 5 };
        },
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.type(screen.getByRole('combobox', { name: 'Etiquetas' }), 'rota');
      await user.click(await screen.findByRole('option', { name: /Crear «rota»/ }));
      expect(await screen.findByText('No se pudo crear «rota».')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(apiClient.post).toHaveBeenCalledWith('/items', expect.objectContaining({ tags: [] }));
    });

    it('rejects a tag name over 50 characters on the client', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor);

      renderAt('/items/nuevo');
      await user.click(await screen.findByRole('combobox', { name: 'Etiquetas' }));
      await user.paste('a'.repeat(51));
      await user.click(await screen.findByRole('option', { name: /Crear «/ }));

      expect(await screen.findByText(/No se pudo crear/)).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('files the new item into the chosen collections with the version it was created at', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPost: (_path, body) => ({ ...rawItem(), ...body, id: 5, version: 1 }),
        onPut: () => rawItem({ id: 5, version: 2 }),
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.click(screen.getByRole('combobox', { name: 'Colecciones' }));
      await user.click(await screen.findByRole('option', { name: 'Novedades' }));
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(apiClient.put).toHaveBeenCalledWith('/items/5/collections', {
        collection_ids: [2],
        version: 1,
      });
    });

    it('sends the editor to the edit screen with a notice when the collections fail', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        items: { 5: rawItem({ id: 5, collections: [] }) },
        onPost: (_path, body) => ({ ...rawItem(), ...body, id: 5 }),
        onPut: () => {
          throw new ApiError('Server error', 500);
        },
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.click(screen.getByRole('combobox', { name: 'Colecciones' }));
      await user.click(await screen.findByRole('option', { name: 'Novedades' }));
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      expect(await screen.findByRole('heading', { name: 'Editar item' })).toBeInTheDocument();
      expect(
        screen.getByText(/El item se creó, pero sus colecciones no se pudieron guardar/),
      ).toBeInTheDocument();
    });

    it('shows a duplicate-slug error on the slug field when the create answers 409', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        onPost: () => {
          throw new ApiError('Slug already exists', 409);
        },
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      expect(await screen.findByText('Ya existe un item con este slug')).toBeInTheDocument();
      expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows other API errors in a form-level alert', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        onPost: () => {
          throw new ApiError('Something broke', 500);
        },
      });

      renderAt('/items/nuevo');
      await fillBasics(user);
      await user.click(screen.getByRole('button', { name: 'Crear item' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    });

    it('validates the fields on the client before calling the API', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor);

      renderAt('/items/nuevo');
      await user.click(await screen.findByRole('button', { name: 'Crear item' }));

      expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
      expect(screen.getByText('El slug es obligatorio')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Slug'), 'Mal Slug');
      await user.click(screen.getByRole('button', { name: 'Crear item' }));
      expect(await screen.findByText(/El slug no es válido/)).toBeInTheDocument();

      await user.click(screen.getByLabelText('Nombre'));
      await user.paste('n'.repeat(201));
      await user.click(screen.getByRole('button', { name: 'Crear item' }));
      expect(
        await screen.findByText('El nombre no puede superar los 200 caracteres'),
      ).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('access', () => {
    it('shows the 404 screen to a viewer on the create route', async () => {
      await mockBackend(rawViewer);

      renderAt('/items/nuevo');

      expect(
        await screen.findByRole('heading', { name: 'Página no encontrada' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    });

    it('shows the 404 screen to an editor editing an item they do not own, and never saves', async () => {
      const { apiClient } = await mockBackend(rawEditor, {
        items: { 1: rawItem({ owner_id: 99 }) },
      });

      renderAt('/items/1/editar');

      expect(
        await screen.findByRole('heading', { name: 'Página no encontrada' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
      expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('lets an admin edit an item owned by someone else', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawAdmin, {
        items: { 1: rawItem({ owner_id: 99 }) },
        onPut: () => rawItem({ owner_id: 99, version: 2 }),
      });

      renderAt('/items/1/editar');
      await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('heading', { name: 'Detalle del item' })).toBeInTheDocument();
      expect(apiClient.put).toHaveBeenCalledWith(
        '/items/1',
        expect.objectContaining({ version: 1 }),
      );
    });

    it('shows the 404 screen when the item does not exist', async () => {
      await mockBackend(rawEditor, { items: {} });

      renderAt('/items/1/editar');

      expect(
        await screen.findByRole('heading', { name: 'Página no encontrada' }),
      ).toBeInTheDocument();
    });

    it('shows a retryable error screen when loading the item fails', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor);
      const impl = vi.mocked(apiClient.get).getMockImplementation();
      let failing = true;
      vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
        if (path === '/items/1' && failing) {
          throw new ApiError('Server error', 500);
        }
        return impl!(path);
      });

      renderAt('/items/1/editar');
      expect(
        await screen.findByRole('heading', { name: 'Error del servidor' }),
      ).toBeInTheDocument();

      failing = false;
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { name: 'Editar item' })).toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('prefills the form and sends the version and the full payload on save', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPut: () => rawItem({ version: 2 }),
      });

      renderAt('/items/1/editar');
      const name = await screen.findByLabelText('Nombre');
      expect(name).toHaveValue('Cámara analógica');
      expect(screen.getByLabelText('Slug')).toHaveValue('camara-analogica');

      await user.clear(name);
      await user.type(name, 'Cámara réflex');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('heading', { name: 'Detalle del item' })).toBeInTheDocument();
      expect(apiClient.put).toHaveBeenCalledTimes(1);
      expect(apiClient.put).toHaveBeenCalledWith('/items/1', {
        name: 'Cámara réflex',
        slug: 'camara-analogica',
        description: 'Una cámara de 35mm.',
        category: 'electronica',
        tags: ['vintage'],
        version: 1,
      });
    });

    it('updates the collections with the new version only when they changed', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, {
        onPut: (path) => (path === '/items/1' ? rawItem({ version: 2 }) : rawItem({ version: 3 })),
      });

      renderAt('/items/1/editar');
      await screen.findByLabelText('Nombre');
      await user.click(screen.getByRole('combobox', { name: 'Colecciones' }));
      await user.click(await screen.findByRole('option', { name: 'Novedades' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(putCalls(apiClient)).toHaveLength(2);
      expect(apiClient.put).toHaveBeenLastCalledWith('/items/1/collections', {
        collection_ids: [1, 2],
        version: 2,
      });
    });

    it('does not touch the collections endpoint when they did not change', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, { onPut: () => rawItem({ version: 2 }) });

      renderAt('/items/1/editar');
      await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(putCalls(apiClient).map(([path]) => path)).toEqual(['/items/1']);
    });

    it('explains a stale version and reloads the latest data on request', async () => {
      const user = userEvent.setup();
      const items: Record<number, RawRecord> = { 1: rawItem() };
      const { apiClient } = await mockBackend(rawEditor, {
        items,
        onPut: () => {
          items[1] = rawItem({ name: 'Cámara de otro', version: 2 });
          throw new ApiError('Version conflict', 409);
        },
      });

      renderAt('/items/1/editar');
      await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Alguien ha modificado este item mientras lo editabas',
      );
      expect(screen.queryByText('Ya existe un item con este slug')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cargar la última versión' }));

      expect(await screen.findByLabelText('Nombre')).toHaveValue('Cámara de otro');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(2));
      expect(apiClient.put).toHaveBeenLastCalledWith(
        '/items/1',
        expect.objectContaining({ version: 2 }),
      );
    });

    it('shows a duplicate-slug error when the 409 is not a stale version', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        onPut: () => {
          throw new ApiError('Slug already exists', 409);
        },
      });

      renderAt('/items/1/editar');
      await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByText('Ya existe un item con este slug')).toBeInTheDocument();
      expect(screen.queryByText(/Alguien ha modificado/)).not.toBeInTheDocument();
    });

    it('treats a 409 from the collections call as a stale version', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        onPut: (path) => {
          if (path === '/items/1') {
            return rawItem({ version: 2 });
          }
          throw new ApiError('Version conflict', 409);
        },
      });

      renderAt('/items/1/editar');
      await screen.findByLabelText('Nombre');
      await user.click(screen.getByRole('combobox', { name: 'Colecciones' }));
      await user.click(await screen.findByRole('option', { name: 'Novedades' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Alguien ha modificado este item mientras lo editabas',
      );
    });

    it('resubmits with the bumped version after the collections call failed', async () => {
      const user = userEvent.setup();
      let collectionsFail = true;
      const { apiClient } = await mockBackend(rawEditor, {
        onPut: (path) => {
          if (path === '/items/1') {
            return rawItem({ version: 2 });
          }
          if (collectionsFail) {
            throw new ApiError('Server error', 500);
          }
          return rawItem({ version: 3 });
        },
      });

      renderAt('/items/1/editar');
      await screen.findByLabelText('Nombre');
      await user.click(screen.getByRole('combobox', { name: 'Colecciones' }));
      await user.click(await screen.findByRole('option', { name: 'Novedades' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Server error');

      collectionsFail = false;
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      const itemPuts = putCalls(apiClient).filter(([path]) => path === '/items/1');
      expect(itemPuts).toHaveLength(2);
      expect(itemPuts[1][1]).toEqual(expect.objectContaining({ version: 2 }));
      expect(screen.queryByText(/Alguien ha modificado/)).not.toBeInTheDocument();
    });

    it('shows other update errors in a form-level alert', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor, {
        onPut: () => {
          throw new ApiError('Forbidden', 403);
        },
      });

      renderAt('/items/1/editar');
      await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    });

    it('lets the user remove a tag and cancel back to the detail', async () => {
      const user = userEvent.setup();
      const { apiClient } = await mockBackend(rawEditor, { onPut: () => rawItem({ version: 2 }) });

      renderAt('/items/1/editar');
      const tags = await screen.findByRole('combobox', { name: 'Etiquetas' });
      expect(tags).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Quitar vintage' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await screen.findByRole('heading', { name: 'Detalle del item' });
      expect(apiClient.put).toHaveBeenCalledWith('/items/1', expect.objectContaining({ tags: [] }));
    });

    it('offers a cancel link back to the item', async () => {
      const user = userEvent.setup();
      await mockBackend(rawEditor);

      renderAt('/items/1/editar');
      await screen.findByLabelText('Nombre');
      await user.click(
        within(screen.getByRole('button', { name: 'Guardar cambios' }).parentElement!).getByRole(
          'link',
          { name: 'Cancelar' },
        ),
      );

      expect(await screen.findByRole('heading', { name: 'Detalle del item' })).toBeInTheDocument();
    });
  });
});
