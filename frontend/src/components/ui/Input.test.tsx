import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('renders no visibility toggle for a non-password input', () => {
    render(<Input label="Email" type="email" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('derives the id from the label when none is given', () => {
    render(<Input label="Correo electrónico" type="email" />);

    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('id', 'correo-electrónico');
  });

  it('uses the id it is given', () => {
    render(<Input id="email" label="Correo electrónico" type="email" />);

    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('id', 'email');
  });

  it('accepts typing', async () => {
    const user = userEvent.setup();
    render(<Input label="Nombre" type="text" />);

    await user.type(screen.getByLabelText('Nombre'), 'Ada');

    expect(screen.getByLabelText('Nombre')).toHaveValue('Ada');
  });

  it('renders a hidden password with a toggle button by default', () => {
    render(<Input label="Password" type="password" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
  });

  it('reveals the password when the toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();
  });

  it('reflects the reveal state on the toggle with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hides the password again when the toggle button is clicked twice', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
  });

  it('renders the error message when the error prop is provided', () => {
    render(<Input label="Email" type="email" error="Email inválido" />);

    expect(screen.getByText('Email inválido')).toBeInTheDocument();
  });

  it('marks the field invalid and points at the message when there is an error', () => {
    render(<Input id="email" label="Email" type="email" error="Email inválido" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Email inválido');
  });

  it('is neither invalid nor described by anything without an error', () => {
    render(<Input id="email" label="Email" type="email" />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('forwards native input attributes such as disabled and placeholder', () => {
    render(<Input label="Email" type="email" placeholder="nombre@correo.com" disabled />);

    const input = screen.getByLabelText('Email');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'nombre@correo.com');
  });
});
