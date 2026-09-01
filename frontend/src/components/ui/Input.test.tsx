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
});
