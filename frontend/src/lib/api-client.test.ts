import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/types/api';
import { apiClient, setAuthToken } from './api-client';

const jsonResponse = (payload: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  }) as Response;

const brokenResponse = (status = 500): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error('not json')),
  }) as Response;

const fetchMock = vi.fn();

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    setAuthToken(null);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('unwraps the data of a successful envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 1, title: 'Some book' }, error: null }),
    );

    await expect(apiClient.get('/books/1')).resolves.toEqual({ id: 1, title: 'Some book' });
  });

  it('sends the JSON content type and no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: [], error: null }));

    await apiClient.get('/books');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBeUndefined();
    expect(init.method).toBe('GET');
  });

  it('adds the bearer token once a session token has been set', async () => {
    setAuthToken('test-token');
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null, error: null }));

    await apiClient.get('/auth/me');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('serializes the body and merges custom headers on a POST', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 7 }, error: null }));

    await apiClient.post('/books', { title: 'New book' }, { 'X-Trace': 'abc' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/books');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'New book' }));
    expect((init.headers as Record<string, string>)['X-Trace']).toBe('abc');
  });

  it.each([
    ['put', () => apiClient.put('/books/1', { title: 'Updated' }), 'PUT'],
    ['patch', () => apiClient.patch('/books/1', { title: 'Patched' }), 'PATCH'],
    ['delete', () => apiClient.delete('/books/1'), 'DELETE'],
  ])('uses the %s HTTP verb', async (_name, call, method) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null, error: null }));

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe(method);
  });

  it('throws an ApiError when the network is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await expect(apiClient.get('/books')).rejects.toThrow(
      new ApiError('Network error: unable to reach the server'),
    );
  });

  it('throws an ApiError with the backend message when the envelope reports a failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, data: null, error: 'Invalid credentials' }, 401),
    );

    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Invalid credentials',
      status: 401,
    });
  });

  it('falls back to the status code when a failed envelope carries no message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, data: null, error: null }, 500));

    await expect(apiClient.get('/books')).rejects.toMatchObject({
      message: 'Request failed with status 500',
      status: 500,
    });
  });

  it('reports the status when a failed response is not a valid envelope', async () => {
    fetchMock.mockResolvedValueOnce(brokenResponse(502));

    await expect(apiClient.get('/books')).rejects.toMatchObject({
      message: 'Request failed with status 502',
      status: 502,
    });
  });

  it('reports an unexpected format when a successful response is not a valid envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await expect(apiClient.get('/books')).rejects.toMatchObject({
      message: 'Unexpected response format from the server',
      status: 200,
    });
  });
});
