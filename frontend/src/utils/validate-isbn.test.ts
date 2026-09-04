import { describe, expect, it } from 'vitest';
import { validateIsbn } from './validate-isbn';

describe('validateIsbn', () => {
  it('accepts a valid ISBN-10', () => {
    expect(validateIsbn('0306406152')).toBe(true);
  });

  it('accepts a valid ISBN-10 whose check digit is X, in lowercase', () => {
    expect(validateIsbn('080442957x')).toBe(true);
  });

  it('accepts a valid ISBN-13', () => {
    expect(validateIsbn('9780306406157')).toBe(true);
  });

  it('ignores dashes and spaces', () => {
    expect(validateIsbn('978-0-306-40615-7')).toBe(true);
    expect(validateIsbn('0 306 40615 2')).toBe(true);
  });

  it('rejects an ISBN-10 with a wrong check digit', () => {
    expect(validateIsbn('0306406153')).toBe(false);
  });

  it('rejects an ISBN-13 with a wrong check digit', () => {
    expect(validateIsbn('9780306406158')).toBe(false);
  });

  it('rejects strings with an invalid length or non-numeric characters', () => {
    expect(validateIsbn('12345')).toBe(false);
    expect(validateIsbn('abcdefghij')).toBe(false);
    expect(validateIsbn('')).toBe(false);
  });
});
