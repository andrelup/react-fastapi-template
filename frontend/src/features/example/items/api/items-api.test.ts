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

const rawItem = {
  id: 1,
  name: 'Cámara analógica',
  slug: 'camara-analogica',
  description: 'Una cámara de 35mm en buen estado.',
  category: 'electronica',
  tags: ['vintage', 'fotografia'],
  owner_id: 7,
  version: 1,
};

const rawPage = {
  items: [rawItem],
  total: 1,
  page: 1,
  page_size: 20,
};

describe('items-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps the raw paginated response onto the camelCase domain type', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { getItems } = await import('./items-api');
    const result = await getItems();

    expect(result).toEqual({
      items: [
        {
          id: 1,
          name: 'Cámara analógica',
          slug: 'camara-analogica',
          description: 'Una cámara de 35mm en buen estado.',
          category: 'electronica',
          tags: ['vintage', 'fotografia'],
          ownerId: 7,
          version: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('builds the query string with default pagination and the requested category', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { getItems } = await import('./items-api');
    await getItems({ category: 'libros' });

    expect(apiClient.get).toHaveBeenCalledWith('/items?page=1&page_size=20&category=libros');
  });

  it('omits the category from the query string when it is not provided', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { getItems } = await import('./items-api');
    await getItems({ page: 2, pageSize: 10 });

    expect(apiClient.get).toHaveBeenCalledWith('/items?page=2&page_size=10');
  });

  it('hits the search endpoint with the query text', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { searchItems } = await import('./items-api');
    await searchItems('cámara', 1, 20);

    expect(apiClient.get).toHaveBeenCalledWith('/items/search?q=c%C3%A1mara&page=1&page_size=20');
  });

  it('maps a single item plus its collections onto the camelCase domain type', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...rawItem,
      collections: [
        { id: 1, name: 'Clásicos' },
        { id: 2, name: 'Colección de otoño' },
      ],
    });

    const { getItem } = await import('./items-api');
    const result = await getItem(1);

    expect(apiClient.get).toHaveBeenCalledWith('/items/1');
    expect(result).toEqual({
      id: 1,
      name: 'Cámara analógica',
      slug: 'camara-analogica',
      description: 'Una cámara de 35mm en buen estado.',
      category: 'electronica',
      tags: ['vintage', 'fotografia'],
      ownerId: 7,
      version: 1,
      collections: [
        { id: 1, name: 'Clásicos' },
        { id: 2, name: 'Colección de otoño' },
      ],
    });
  });

  it('maps a single item with no collections to an empty array', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...rawItem, collections: [] });

    const { getItem } = await import('./items-api');
    const result = await getItem(1);

    expect(result.collections).toEqual([]);
  });

  it('calls DELETE on the item endpoint', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.delete).mockResolvedValueOnce(null);

    const { deleteItem } = await import('./items-api');
    await deleteItem(1);

    expect(apiClient.delete).toHaveBeenCalledWith('/items/1');
  });

  describe('writes', () => {
    const input = {
      name: 'Cámara analógica',
      slug: 'camara-analogica',
      description: null,
      category: null,
      tags: ['vintage'],
    };

    it('createItem posts the payload and maps the response', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { createItem } = await import('./items-api');
      vi.mocked(apiClient.post).mockResolvedValueOnce(rawItem);

      const created = await createItem(input);

      expect(apiClient.post).toHaveBeenCalledWith('/items', input);
      expect(created).toMatchObject({ id: 1, ownerId: 7, version: 1 });
    });

    it('updateItem puts the full payload with the version', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { updateItem } = await import('./items-api');
      vi.mocked(apiClient.put).mockResolvedValueOnce({ ...rawItem, version: 4 });

      const updated = await updateItem(1, input, 3);

      expect(apiClient.put).toHaveBeenCalledWith('/items/1', { ...input, version: 3 });
      expect(updated.version).toBe(4);
    });

    it('setItemCollections sends snake_case and maps the detail', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { setItemCollections } = await import('./items-api');
      vi.mocked(apiClient.put).mockResolvedValueOnce({
        ...rawItem,
        version: 2,
        collections: [{ id: 5, name: 'Clásicos' }],
      });

      const detail = await setItemCollections(1, [5], 1);

      expect(apiClient.put).toHaveBeenCalledWith('/items/1/collections', {
        collection_ids: [5],
        version: 1,
      });
      expect(detail.collections).toEqual([{ id: 5, name: 'Clásicos' }]);
      expect(detail.ownerId).toBe(7);
    });

    it('searchTags unwraps the tag list and sends the query', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { searchTags } = await import('./items-api');
      vi.mocked(apiClient.get).mockResolvedValueOnce({ tags: [{ id: 1, name: 'vintage' }] });

      expect(await searchTags('vin')).toEqual([{ id: 1, name: 'vintage' }]);
      expect(apiClient.get).toHaveBeenCalledWith('/tags?q=vin');
    });

    it('searchTags omits an empty query', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { searchTags } = await import('./items-api');
      vi.mocked(apiClient.get).mockResolvedValueOnce({ tags: [] });

      await searchTags('');

      expect(apiClient.get).toHaveBeenCalledWith('/tags');
    });

    it('createTag posts the name and returns the tag', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { createTag } = await import('./items-api');
      vi.mocked(apiClient.post).mockResolvedValueOnce({ id: 8, name: 'retro' });

      expect(await createTag('retro')).toEqual({ id: 8, name: 'retro' });
      expect(apiClient.post).toHaveBeenCalledWith('/tags', { name: 'retro' });
    });

    it('getCollectionRefs maps the paginated collections onto id and name', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const { getCollectionRefs } = await import('./items-api');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        items: [{ id: 2, name: 'Novedades', description: 'x', version: 3 }],
        total: 1,
        page: 1,
        page_size: 100,
      });

      expect(await getCollectionRefs()).toEqual([{ id: 2, name: 'Novedades' }]);
      expect(apiClient.get).toHaveBeenCalledWith('/collections?page=1&page_size=100');
    });
  });
});
