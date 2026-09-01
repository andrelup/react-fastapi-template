import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoResultsState } from './NoResultsState';

describe('NoResultsState', () => {
  it('renders the default title and description', () => {
    render(<NoResultsState />);

    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'No hemos encontrado ningún artículo que coincida con tu búsqueda. Prueba con otros términos.',
      ),
    ).toBeInTheDocument();
  });

  it('renders custom title and description when provided', () => {
    render(<NoResultsState title="Sin libros" description="Prueba otra categoría." />);

    expect(screen.getByRole('heading', { name: 'Sin libros' })).toBeInTheDocument();
    expect(screen.getByText('Prueba otra categoría.')).toBeInTheDocument();
  });

  it('does not render the clear-search button when onClearSearch is missing', () => {
    render(<NoResultsState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the clear-search button and fires onClearSearch when clicked', async () => {
    const user = userEvent.setup();
    const onClearSearch = vi.fn();

    render(<NoResultsState onClearSearch={onClearSearch} />);

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });
});
