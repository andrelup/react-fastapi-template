import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('derives the id from the label when none is given', () => {
    render(<Textarea label="Descripción" />);

    expect(screen.getByLabelText('Descripción')).toHaveAttribute('id', 'descripción');
  });

  it('uses the id it is given', () => {
    render(<Textarea id="description" label="Descripción" />);

    expect(screen.getByLabelText('Descripción')).toHaveAttribute('id', 'description');
  });

  it('accepts typing', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Descripción" />);

    await user.type(screen.getByLabelText('Descripción'), 'Un texto de ejemplo');

    expect(screen.getByLabelText('Descripción')).toHaveValue('Un texto de ejemplo');
  });

  it('renders the error message when the error prop is provided', () => {
    render(<Textarea label="Descripción" error="La descripción es obligatoria." />);

    expect(screen.getByText('La descripción es obligatoria.')).toBeInTheDocument();
  });

  it('marks the field invalid and points at the message when there is an error', () => {
    render(
      <Textarea id="description" label="Descripción" error="La descripción es obligatoria." />,
    );

    const textarea = screen.getByLabelText('Descripción');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('La descripción es obligatoria.');
  });

  it('is neither invalid nor described by anything without an error', () => {
    render(<Textarea id="description" label="Descripción" />);

    const textarea = screen.getByLabelText('Descripción');
    expect(textarea).toHaveAttribute('aria-invalid', 'false');
    expect(textarea).not.toHaveAttribute('aria-describedby');
  });

  it('forwards native textarea attributes such as disabled and placeholder', () => {
    render(<Textarea label="Descripción" placeholder="Cuéntanos algo" disabled />);

    const textarea = screen.getByLabelText('Descripción');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute('placeholder', 'Cuéntanos algo');
  });
});
