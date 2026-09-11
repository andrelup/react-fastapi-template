import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Eliminar elemento"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminar elemento"
        description="Esta acción no se puede deshacer."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Eliminar elemento' })).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onOpenChange={vi.fn()} title="Eliminar elemento" onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes through onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Eliminar elemento"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables the confirm button and shows the loading label while isLoading', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminar elemento"
        onConfirm={vi.fn()}
        isLoading
      />,
    );

    expect(screen.getByRole('button', { name: 'Cargando…' })).toBeDisabled();
  });

  it('accepts custom labels', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Eliminar colección"
        confirmLabel="Sí, eliminar"
        cancelLabel="No, mantener"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, mantener' })).toBeInTheDocument();
  });
});
