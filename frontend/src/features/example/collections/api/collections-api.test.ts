import { afterEach, describe, expect, it, vi } from 'vitest';

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

const rawCollection = {
  id: 1,
  name: 'Clásicos',
  description: 'Los imprescindibles.',
  version: 2,
};

describe('collections-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps the raw paginated response onto the camelCase domain type', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [rawCollection],
      total: 1,
      page: 1,
      page_size: 20,
    });

    const { getCollections } = await import('./collections-api');
    const result = await getCollections();

    expect(apiClient.get).toHaveBeenCalledWith('/collections?page=1&page_size=20');
    expect(result).toEqual({
      items: [{ id: 1, name: 'Clásicos', description: 'Los imprescindibles.', version: 2 }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('sends the requested page and page size', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 3,
      page_size: 10,
    });

    const { getCollections } = await import('./collections-api');
    await getCollections({ page: 3, pageSize: 10 });

    expect(apiClient.get).toHaveBeenCalledWith('/collections?page=3&page_size=10');
  });

  it('maps a collection detail with its items', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...rawCollection,
      description: null,
      items: [{ id: 5, name: 'Cámara analógica' }],
    });

    const { getCollection } = await import('./collections-api');
    const result = await getCollection(1);

    expect(apiClient.get).toHaveBeenCalledWith('/collections/1');
    expect(result).toEqual({
      id: 1,
      name: 'Clásicos',
      description: null,
      version: 2,
      items: [{ id: 5, name: 'Cámara analógica' }],
    });
  });

  it('deletes a collection by id', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.delete).mockResolvedValueOnce(null);

    const { deleteCollection } = await import('./collections-api');
    await deleteCollection(1);

    expect(apiClient.delete).toHaveBeenCalledWith('/collections/1');
  });
});
