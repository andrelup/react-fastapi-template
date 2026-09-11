import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

describe('Card', () => {
  it('renders header, title, description, content and footer together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Título de ejemplo</CardTitle>
          <CardDescription>Subtítulo de ejemplo</CardDescription>
        </CardHeader>
        <CardContent>Contenido de ejemplo</CardContent>
        <CardFooter>Pie de ejemplo</CardFooter>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Título de ejemplo' })).toBeInTheDocument();
    expect(screen.getByText('Subtítulo de ejemplo')).toBeInTheDocument();
    expect(screen.getByText('Contenido de ejemplo')).toBeInTheDocument();
    expect(screen.getByText('Pie de ejemplo')).toBeInTheDocument();
  });

  it('exposes the title as a level 3 heading', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Título de ejemplo</CardTitle>
        </CardHeader>
      </Card>,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Título de ejemplo' }),
    ).toBeInTheDocument();
  });

  it('accepts an extra className on the surface', () => {
    render(
      <Card className="max-w-sm">
        <CardContent>Contenido de ejemplo</CardContent>
      </Card>,
    );

    expect(screen.getByText('Contenido de ejemplo').parentElement).toHaveClass('max-w-sm');
  });

  it('lets each part take its own className', () => {
    render(
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Título</CardTitle>
          <CardDescription className="italic">Subtítulo</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">Contenido</CardContent>
        <CardFooter className="justify-end">Pie</CardFooter>
      </Card>,
    );

    expect(screen.getByRole('heading', { name: 'Título' })).toHaveClass('text-xl');
    expect(screen.getByText('Subtítulo')).toHaveClass('italic');
    expect(screen.getByText('Contenido')).toHaveClass('pt-2');
    expect(screen.getByText('Pie')).toHaveClass('justify-end');
  });
});
