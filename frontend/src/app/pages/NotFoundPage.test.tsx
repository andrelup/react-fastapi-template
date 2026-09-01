import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
  it('shows the not-found message', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });

  it('navigates to the home page when "Volver al inicio" is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <Routes>
          <Route path="/" element={<h1>Welcome to BookShelf</h1>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(screen.getByRole('heading', { name: 'Welcome to BookShelf' })).toBeInTheDocument();
  });

  it('renders the 404 page for an unknown route within the app routing', () => {
    render(
      <MemoryRouter initialEntries={['/this-page-does-not-exist']}>
        <Routes>
          <Route path="/" element={<h1>Welcome to BookShelf</h1>} />
          <Route path="/login" element={<h1>Log in</h1>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });
});
