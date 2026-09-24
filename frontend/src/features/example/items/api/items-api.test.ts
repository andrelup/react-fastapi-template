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
});
