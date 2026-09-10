import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button with its content', () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Guardar</Button>);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is reachable and activatable from the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Guardar</Button>);
    await user.tab();

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders every variant as a button', () => {
    render(
      <>
        <Button>Principal</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="link">Enlace</Button>
        <Button variant="destructive">Eliminar</Button>
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('renders every size as a button', () => {
    render(
      <>
        <Button size="sm">Pequeño</Button>
        <Button size="default">Normal</Button>
        <Button size="lg">Grande</Button>
        <Button size="icon" aria-label="Eliminar elemento">
          <span aria-hidden="true">×</span>
        </Button>
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Eliminar elemento' })).toBeInTheDocument();
  });

  it('replaces its content with a Spanish loading label and disables itself when isLoading', () => {
    render(<Button isLoading>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Cargando…' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('does not fire onClick while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button isLoading onClick={onClick}>
        Guardar
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Cargando…' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('lets an explicit disabled={false} win over isLoading', () => {
    render(
      <Button isLoading disabled={false}>
        Guardar
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Cargando…' })).toBeEnabled();
  });

  it('is disabled when disabled is passed', () => {
    render(<Button disabled>Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('renders the child element instead of a button when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/inicio">Ir al inicio</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/inicio');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets the caller override a default class', () => {
    render(<Button className="w-full">Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('w-full');
  });
});
