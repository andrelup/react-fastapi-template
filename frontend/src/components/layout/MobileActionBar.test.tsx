import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileActionBar } from './MobileActionBar';

describe('MobileActionBar', () => {
  it('renders its children', () => {
    render(
      <MobileActionBar>
        <span>Total: 14,00 €</span>
        <button type="button">Confirmar</button>
      </MobileActionBar>,
    );

    expect(screen.getByText('Total: 14,00 €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });
});
