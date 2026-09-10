import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UiComponentsPage from './UiComponentsPage';

describe('UiComponentsPage', () => {
  it('renders every showcase section', () => {
    render(<UiComponentsPage />);

    expect(screen.getByRole('heading', { name: 'Componentes UI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Botones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tarjeta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Avatar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Badge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spinner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diálogo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estados del sistema' })).toBeInTheDocument();
  });

  it('shows the button variants and sizes', () => {
    render(<UiComponentsPage />);

    expect(screen.getByRole('button', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secundario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contorno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fantasma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enlace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar elemento' })).toBeInTheDocument();
  });

  it('shows the disabled and loading states of the button', () => {
    render(<UiComponentsPage />);

    expect(screen.getByRole('button', { name: 'Deshabilitado' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cargando…' })).toBeDisabled();
  });

  it('shows a field with an error wired to the input', () => {
    render(<UiComponentsPage />);

    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription('La contraseña debe tener al menos 8 caracteres.');
  });

  it('opens the dialog when its trigger is clicked and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Diálogo de ejemplo' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('records the action fired from a system state', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('Última acción: reintentar')).toBeInTheDocument();
  });
});
