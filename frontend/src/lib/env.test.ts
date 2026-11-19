import { describe, expect, it } from 'vitest';
import { requireApiUrl } from './env';

describe('requireApiUrl', () => {
  it('returns the configured API URL', () => {
    expect(requireApiUrl({ VITE_API_URL: 'https://api.example.com' })).toBe(
      'https://api.example.com',
    );
  });

  it('accepts a relative path, as a reverse proxy in front of the API would use', () => {
    expect(requireApiUrl({ VITE_API_URL: '/api' })).toBe('/api');
  });

  it('strips the whitespace around the value', () => {
    expect(requireApiUrl({ VITE_API_URL: '  https://api.example.com \n' })).toBe(
      'https://api.example.com',
    );
  });

  it.each([
    { state: 'missing', env: {} },
    { state: 'empty', env: { VITE_API_URL: '' } },
    { state: 'blank', env: { VITE_API_URL: '   ' } },
  ])('throws an error naming the variable when it is $state', ({ env }) => {
    expect(() => requireApiUrl(env)).toThrow(/VITE_API_URL is not set/);
  });
});
