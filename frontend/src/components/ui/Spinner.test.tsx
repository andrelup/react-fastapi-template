import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('exposes itself as a status with a Spanish accessible name', () => {
    render(<Spinner />);

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders at every size', () => {
    const { rerender } = render(<Spinner size="sm" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<Spinner size="md" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<Spinner size="lg" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('accepts an extra className without losing its role', () => {
    render(<Spinner className="mx-auto" />);

    expect(screen.getByRole('status')).toHaveClass('mx-auto');
  });
});
