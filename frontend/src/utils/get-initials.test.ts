import { describe, expect, it } from 'vitest';
import { getInitials } from './get-initials';

describe('getInitials', () => {
  it('returns the initials of the first and last word for a two-word name', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
  });

  it('returns a single initial for a one-word name', () => {
    expect(getInitials('Ada')).toBe('A');
  });

  it('returns the initials of the first and last word for a name with three or more words', () => {
    expect(getInitials('Ada Augusta Lovelace')).toBe('AL');
  });

  it('is tolerant of extra whitespace between words', () => {
    expect(getInitials('  Ada    Lovelace  ')).toBe('AL');
  });

  it('returns an empty string for an empty name', () => {
    expect(getInitials('')).toBe('');
  });
});
