import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NavGroup } from './NavGroup';

describe('NavGroup', () => {
  it('exposes its entries as a group named by the heading', () => {
    render(
      <NavGroup label="Cuenta">
        <a href="/a">Uno</a>
      </NavGroup>,
    );

    const group = screen.getByRole('group', { name: 'Cuenta' });
    expect(within(group).getByRole('link', { name: 'Uno' })).toBeInTheDocument();
    expect(within(group).getByText('Cuenta')).toBeInTheDocument();
  });

  it('gives two groups two distinct names', () => {
    render(
      <>
        <NavGroup label="Principal">
          <span>a</span>
        </NavGroup>
        <NavGroup label="Desarrollo">
          <span>b</span>
        </NavGroup>
      </>,
    );

    expect(screen.getByRole('group', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Desarrollo' })).toBeInTheDocument();
  });
});
