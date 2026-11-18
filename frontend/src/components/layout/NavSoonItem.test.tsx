import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavSoonItem } from './NavSoonItem';

describe('NavSoonItem', () => {
  it('shows the label with the «Próximamente» pill and is disabled, not a link', () => {
    render(<NavSoonItem label="Mensajes" />);

    const item = screen.getByText('Mensajes').closest('[aria-disabled="true"]');
    expect(item).toHaveTextContent('Mensajes');
    expect(item).toHaveTextContent('Próximamente');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the icon hidden from assistive technology', () => {
    render(<NavSoonItem label="Ajustes" icon={<svg data-testid="icon" />} />);

    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
