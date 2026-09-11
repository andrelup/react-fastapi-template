import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

const ExampleDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Abrir diálogo</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Diálogo de ejemplo</DialogTitle>
        <DialogDescription>Contenido de ejemplo dentro del diálogo.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

describe('Dialog', () => {
  it('stays closed until its trigger is used', () => {
    render(<ExampleDialog />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir diálogo' })).toBeInTheDocument();
  });

  it('opens on the trigger and announces itself as a modal dialog', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Diálogo de ejemplo' })).toBeInTheDocument();
    expect(screen.getByText('Contenido de ejemplo dentro del diálogo.')).toBeInTheDocument();
  });

  it('traps the focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    const dialog = await screen.findByRole('dialog');

    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the pointer goes down outside the panel', async () => {
    // Radix marks the rest of the document as inert while the dialog is open,
    // so the pointer-events guard has to be relaxed to click through it.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await screen.findByRole('dialog');

    await user.click(document.body);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from its own close control', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from a DialogClose wrapping a Button', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns the focus to the trigger once it closes', async () => {
    const user = userEvent.setup();
    render(<ExampleDialog />);

    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(trigger).toHaveFocus();
  });

  it('lets each part take its own className', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir diálogo</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl">Título</DialogTitle>
            <DialogDescription className="italic">Descripción</DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-between">Pie</DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }));

    expect(await screen.findByRole('dialog')).toHaveClass('max-w-lg');
    expect(screen.getByRole('heading', { name: 'Título' })).toHaveClass('text-xl');
    expect(screen.getByText('Descripción')).toHaveClass('italic');
    expect(screen.getByText('Pie')).toHaveClass('justify-between');
  });
});
