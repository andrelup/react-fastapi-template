import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileAccountPanel } from './MobileAccountPanel';

const renderPanel = () => {
  const onClose = vi.fn();
  const onLogout = vi.fn();
  render(
    <MobileAccountPanel
      name="Ada Lovelace"
      email="ada@example.com"
      onClose={onClose}
      onLogout={onLogout}
    >
      <a href="/x">Entrada</a>
    </MobileAccountPanel>,
  );
  return { onClose, onLogout };
};

describe('MobileAccountPanel', () => {
  it('shows the profile block and the menu it is given', () => {
    renderPanel();

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
    expect(screen.getByRole('navigation', { name: 'Menú de cuenta' })).toContainElement(
      screen.getByRole('link', { name: 'Entrada' }),
    );
  });

  it('calls onClose from the close button', async () => {
    const { onClose } = renderPanel();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onLogout from the logout button', async () => {
    const { onLogout } = renderPanel();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
