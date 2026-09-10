import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins the class names it is given', () => {
    expect(cn('rounded', 'font-semibold')).toBe('rounded font-semibold');
  });

  it('drops falsy values so conditionals can be inlined', () => {
    const isCompact = false;

    expect(cn('rounded', isCompact && 'hidden', undefined, null, 'text-ink')).toBe(
      'rounded text-ink',
    );
  });

  it('keeps the class of a condition that holds', () => {
    const hasError = true;

    expect(cn('border-input', hasError && 'border-danger')).toBe('border-danger');
  });

  it('lets the last class win when two conflict', () => {
    expect(cn('px-5 py-3', 'px-3')).toBe('py-3 px-3');
  });

  it('lets a caller override the component colour', () => {
    expect(cn('border-input', 'border-danger')).toBe('border-danger');
  });
});
