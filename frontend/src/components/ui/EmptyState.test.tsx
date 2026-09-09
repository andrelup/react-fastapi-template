import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the given title and description', () => {
    render(<EmptyState title="No hay elementos" description="Añade elementos para verlos aquí." />);

    expect(screen.getByRole('heading', { name: 'No hay elementos' })).toBeInTheDocument();
    expect(screen.getByText('Añade elementos para verlos aquí.')).toBeInTheDocument();
  });

  it('does not render an action when actionLabel/onAction are missing', () => {
    render(<EmptyState title="Vacío" description="No hay nada aquí." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the action button and fires onAction when clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <EmptyState
        title="Vacío"
        description="No hay nada aquí."
        actionLabel="Explorar catálogo"
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Explorar catálogo' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
