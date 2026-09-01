import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge>2</Badge>);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders text content passed as children', () => {
    render(<Badge>Nuevo</Badge>);

    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });
});
