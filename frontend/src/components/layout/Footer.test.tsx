import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the copyright with the short label always present', () => {
    render(<Footer />);

    // The full "Todos los derechos reservados." is only shown on desktop
    // (md:inline); it is still in the DOM so the whole text is readable.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === 'p' &&
          element.textContent === '© 2026 BookShelf. Todos los derechos reservados.',
      ),
    ).toBeInTheDocument();
  });

  it('applies an extra className to the footer element', () => {
    const { container } = render(<Footer className="hidden md:flex" />);

    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer?.className).toContain('hidden');
    expect(footer?.className).toContain('md:flex');
  });
});
