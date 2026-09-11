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

  it('renders every variant', () => {
    render(
      <>
        <Badge>Por defecto</Badge>
        <Badge variant="secondary">Secundario</Badge>
        <Badge variant="outline">Contorno</Badge>
        <Badge variant="destructive">Caducado</Badge>
      </>,
    );

    expect(screen.getByText('Por defecto')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Contorno')).toBeInTheDocument();
    expect(screen.getByText('Caducado')).toBeInTheDocument();
  });

  it('accepts an extra className', () => {
    render(<Badge className="ml-2">Nuevo</Badge>);

    expect(screen.getByText('Nuevo')).toHaveClass('ml-2');
  });

  it('forwards native span attributes', () => {
    render(<Badge title="Mensajes sin leer">1</Badge>);

    expect(screen.getByTitle('Mensajes sin leer')).toHaveTextContent('1');
  });
});
