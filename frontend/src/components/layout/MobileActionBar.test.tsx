import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileActionBar } from './MobileActionBar';

describe('MobileActionBar', () => {
  it('renders its children', () => {
    render(
      <MobileActionBar>
        <span>€14,00</span>
        <button type="button">Añadir al carrito</button>
      </MobileActionBar>,
    );

    expect(screen.getByText('€14,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir al carrito' })).toBeInTheDocument();
  });
});
