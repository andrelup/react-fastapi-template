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
    expect(screen.getByRole('heading', { name: 'Modal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estados del sistema' })).toBeInTheDocument();
  });

  it('opens the modal when its trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<UiComponentsPage />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir modal' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
