import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerErrorState } from './ServerErrorState';

describe('ServerErrorState', () => {
  it('renders the default title and description', () => {
    render(<ServerErrorState />);

    expect(screen.getByRole('heading', { name: 'Error del servidor' })).toBeInTheDocument();
    expect(
      screen.getByText('Algo ha fallado de nuestro lado. Inténtalo de nuevo en unos minutos.'),
    ).toBeInTheDocument();
  });

  it('renders custom title and description when provided', () => {
    render(<ServerErrorState title="No se pudo cargar" description="Revisa tu conexión." />);

    expect(screen.getByRole('heading', { name: 'No se pudo cargar' })).toBeInTheDocument();
    expect(screen.getByText('Revisa tu conexión.')).toBeInTheDocument();
  });

  it('does not render the retry button when onRetry is missing', () => {
    render(<ServerErrorState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the retry button and fires onRetry when clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ServerErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
