import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { value: 'es', label: 'España' },
  { value: 'fr', label: 'Francia' },
];

describe('Select', () => {
  it('derives the id from the label when none is given', () => {
    render(<Select label="País" options={options} />);

    expect(screen.getByLabelText('País')).toHaveAttribute('id', 'país');
  });

  it('opens and lets the user choose an option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select label="País" options={options} onValueChange={onValueChange} />);

    await user.click(screen.getByRole('combobox', { name: 'País' }));
    await user.click(await screen.findByRole('option', { name: 'España' }));

    expect(onValueChange).toHaveBeenCalledWith('es');
  });

  it('shows a message when there are no options', async () => {
    const user = userEvent.setup();
    render(<Select label="País" options={[]} />);

    await user.click(screen.getByRole('combobox', { name: 'País' }));

    expect(await screen.findByText('No hay opciones disponibles.')).toBeInTheDocument();
  });

  it('marks the field invalid and points at the message when there is an error', () => {
    render(<Select label="País" options={options} error="Selecciona un país." />);

    const trigger = screen.getByRole('combobox', { name: 'País' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Selecciona un país.');
    expect(screen.getByText('Selecciona un país.')).toBeInTheDocument();
  });

  it('is neither invalid nor described by anything without an error', () => {
    render(<Select label="País" options={options} />);

    const trigger = screen.getByRole('combobox', { name: 'País' });
    expect(trigger).toHaveAttribute('aria-invalid', 'false');
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('disables the trigger when disabled is set', () => {
    render(<Select label="País" options={options} disabled />);

    expect(screen.getByRole('combobox', { name: 'País' })).toBeDisabled();
  });

  it('disables the trigger and shows a loading placeholder when isLoading is set', () => {
    render(<Select label="País" options={options} isLoading />);

    expect(screen.getByRole('combobox', { name: 'País' })).toBeDisabled();
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });
});
