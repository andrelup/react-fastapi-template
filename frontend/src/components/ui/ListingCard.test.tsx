import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListingCard } from './ListingCard';

describe('ListingCard', () => {
  it('renders the title and description', () => {
    render(<ListingCard title="Silla de roble" description="Silla artesanal de madera maciza." />);

    expect(screen.getByRole('heading', { name: 'Silla de roble' })).toBeInTheDocument();
    expect(screen.getByText('Silla artesanal de madera maciza.')).toBeInTheDocument();
  });

  it('shows a placeholder icon when there is no cover image', () => {
    render(<ListingCard title="Silla de roble" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the cover image when given one', () => {
    render(<ListingCard title="Silla de roble" coverUrl="/silla.jpg" coverAlt="Silla de roble" />);

    expect(screen.getByRole('img', { name: 'Silla de roble' })).toHaveAttribute(
      'src',
      '/silla.jpg',
    );
  });

  it('renders the title as plain text when there is no onSelect handler', () => {
    render(<ListingCard title="Silla de roble" />);

    expect(screen.queryByRole('button', { name: 'Silla de roble' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Silla de roble' })).toBeInTheDocument();
  });

  it('makes the title clickable and fires onSelect when given one', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ListingCard title="Silla de roble" onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Silla de roble' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders the given badge, meta and actions', () => {
    render(
      <ListingCard
        title="Silla de roble"
        badge={<Badge>Nuevo</Badge>}
        meta={<span>24,90 €</span>}
        actions={<Button size="sm">Añadir a colección</Button>}
      />,
    );

    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByText('24,90 €')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir a colección' })).toBeInTheDocument();
  });
});
