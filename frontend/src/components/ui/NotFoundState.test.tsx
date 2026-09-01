import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotFoundState } from './NotFoundState';

describe('NotFoundState', () => {
  it('renders the default title and description', () => {
    render(<NotFoundState />);

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
    expect(
      screen.getByText('La ruta que buscas no existe o se ha movido a otra dirección.'),
    ).toBeInTheDocument();
  });

  it('renders custom title and description when provided', () => {
    render(<NotFoundState title="Libro no encontrado" description="Puede que ya no exista." />);

    expect(screen.getByRole('heading', { name: 'Libro no encontrado' })).toBeInTheDocument();
    expect(screen.getByText('Puede que ya no exista.')).toBeInTheDocument();
  });

  it('does not render the go-home button when onGoHome is missing', () => {
    render(<NotFoundState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the go-home button and fires onGoHome when clicked', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();

    render(<NotFoundState onGoHome={onGoHome} />);

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
