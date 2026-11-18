import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DrawerLinkItem } from './DrawerLinkItem';

const renderItem = (onNavigate = vi.fn()) => {
  render(
    <MemoryRouter>
      <DrawerLinkItem
        icon={<svg />}
        label="Ver colecciones"
        to="/colecciones"
        onNavigate={onNavigate}
      />
    </MemoryRouter>,
  );
  return { onNavigate, link: screen.getByRole('link', { name: 'Ver colecciones' }) };
};

describe('DrawerLinkItem', () => {
  it('is a link to its route', () => {
    const { link } = renderItem();

    expect(link).toHaveAttribute('href', '/colecciones');
  });

  it('calls onNavigate on a plain click', async () => {
    const { onNavigate, link } = renderItem();

    await userEvent.setup().click(link);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it.each(['Control', 'Meta', 'Shift', 'Alt'])(
    'does not call onNavigate on a %s-click, which opens elsewhere',
    async (key) => {
      const user = userEvent.setup();
      const { onNavigate, link } = renderItem();

      await user.keyboard(`{${key}>}`);
      await user.click(link);
      await user.keyboard(`{/${key}}`);

      expect(onNavigate).not.toHaveBeenCalled();
    },
  );

  it('does not call onNavigate on a middle click', () => {
    const { onNavigate, link } = renderItem();

    fireEvent.click(link, { button: 1 });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('works without an onNavigate', async () => {
    render(
      <MemoryRouter>
        <DrawerLinkItem icon={<svg />} label="Solo enlace" to="/x" />
      </MemoryRouter>,
    );

    await userEvent.setup().click(screen.getByRole('link', { name: 'Solo enlace' }));

    expect(screen.getByRole('link', { name: 'Solo enlace' })).toBeInTheDocument();
  });
});
