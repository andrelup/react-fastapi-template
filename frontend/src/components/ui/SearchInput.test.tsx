import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onSearch with the initial value on mount', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Buscar productos" onSearch={onSearch} />);

    expect(onSearch).toHaveBeenCalledWith('');
  });

  // `userEvent`'s per-keystroke delay deadlocks against fake timers, so these
  // two follow `useDebounce.test.ts` instead: `fireEvent` for the input and
  // `act(() => vi.advanceTimersByTime(...))` for the clock.
  it('does not call onSearch again before the delay has elapsed', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Buscar productos" onSearch={onSearch} delayMs={300} />);
    onSearch.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar productos' }), {
      target: { value: 'silla' },
    });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('calls onSearch with the typed value once the delay elapses', () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Buscar productos" onSearch={onSearch} delayMs={300} />);
    onSearch.mockClear();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar productos' }), {
      target: { value: 'silla' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith('silla');
  });

  it('forwards disabled and placeholder to the field', () => {
    render(
      <SearchInput
        label="Buscar productos"
        onSearch={vi.fn()}
        placeholder="Nombre del producto"
        disabled
      />,
    );

    const field = screen.getByRole('searchbox', { name: 'Buscar productos' });
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute('placeholder', 'Nombre del producto');
  });

  it('accepts typing with real timers', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<SearchInput label="Buscar productos" onSearch={vi.fn()} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'silla');

    expect(screen.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('silla');
  });
});
