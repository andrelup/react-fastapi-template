import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('is exposed as an image named after the person', () => {
    render(<Avatar name="Ada Lovelace" />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('shows the initials of the name', () => {
    render(<Avatar name="Ada Lovelace" />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('renders at every size', () => {
    const { rerender } = render(<Avatar name="Ada Lovelace" size="sm" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');

    rerender(<Avatar name="Ada Lovelace" size="md" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');

    rerender(<Avatar name="Ada Lovelace" size="lg" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('falls back to the initials while the picture is unavailable', () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/ada.png" />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('accepts an extra className', () => {
    render(<Avatar name="Ada Lovelace" className="ring-2" />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveClass('ring-2');
  });
});
