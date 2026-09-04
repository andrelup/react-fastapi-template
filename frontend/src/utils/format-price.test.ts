import { describe, expect, it } from 'vitest';
import { formatPrice } from './format-price';

describe('formatPrice', () => {
  it('formats a price in euros with the default locale', () => {
    expect(formatPrice(12.5)).toBe('€12.50');
  });

  it('rounds to two decimals', () => {
    expect(formatPrice(9.999)).toBe('€10.00');
  });

  it('honours a different currency and locale', () => {
    expect(formatPrice(1000, 'USD', 'en-US')).toBe('$1,000.00');
  });
});
