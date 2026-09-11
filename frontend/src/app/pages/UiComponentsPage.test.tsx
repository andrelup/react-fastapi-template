import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UiComponentsPage from './UiComponentsPage';

describe('UiComponentsPage', () => {
  it('renders every showcase section', () => {
    render(<UiComponentsPage />);

    expect(screen.getByRole('heading', { name: 'Componentes UI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Botones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selector' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Área de texto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Buscador' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tarjeta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tarjeta de listado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Avatar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Badge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spinner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diálogo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diálogo de confirmación' })).toBeInTheDocument();
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

  it('shows a select with an error wired to its trigger, and its disabled and loading states', () => {
    render(<UiComponentsPage />);

    const invalidSelect = screen.getByRole('combobox', { name: 'Categoría con error' });
    expect(invalidSelect).toHaveAttribute('aria-invalid', 'true');
    expect(invalidSelect).toHaveAccessibleDescription('Selecciona una categoría.');

    expect(screen.getByRole('combobox', { name: 'Categoría (cargando)' })).toBeDisabled();
  });

  it('shows a message when a select has no options', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    await user.click(screen.getByRole('combobox', { name: 'Categoría (sin opciones)' }));

    expect(await screen.findByText('No hay opciones disponibles.')).toBeInTheDocument();
  });

  it('shows a textarea with an error wired to it', () => {
    render(<UiComponentsPage />);

    expect(screen.getByText('La descripción es obligatoria.')).toBeInTheDocument();
  });

  it('shows the search field', () => {
    render(<UiComponentsPage />);

    expect(screen.getByRole('searchbox', { name: 'Buscar en el catálogo' })).toBeEnabled();
    expect(
      screen.getByRole('searchbox', { name: 'Buscar en el catálogo (deshabilitado)' }),
    ).toBeDisabled();
  });

  it('fires onSelect from the listing card title', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    await user.click(screen.getByRole('button', { name: 'Silla de roble' }));

    expect(screen.getByText('Última acción: ver-silla')).toBeInTheDocument();
  });

  it('lets pagination change the current page', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    const interactivePagination = screen.getAllByRole('navigation', { name: 'Paginación' })[0];
    const pagination = within(interactivePagination);

    expect(pagination.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(pagination.getByRole('button', { name: 'Página 2' }));

    expect(pagination.getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
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

  it('opens the confirm dialog and records the action when confirmed', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    await user.click(screen.getByRole('button', { name: 'Eliminar artículo' }));

    const dialog = await screen.findByRole('dialog');
    expect(screen.getByRole('heading', { name: 'Eliminar artículo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(dialog).not.toBeInTheDocument();
    expect(screen.getByText('Última acción: eliminar-articulo')).toBeInTheDocument();
  });

  it('records the action fired from a system state', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('Última acción: reintentar')).toBeInTheDocument();
  });
});
