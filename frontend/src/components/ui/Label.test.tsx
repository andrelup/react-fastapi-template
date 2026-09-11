import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Label } from './Label';

describe('Label', () => {
  it('names the control it points at', () => {
    render(
      <>
        <Label htmlFor="apodo">Apodo</Label>
        <input id="apodo" />
      </>,
    );

    expect(screen.getByLabelText('Apodo')).toBeInTheDocument();
  });

  it('moves the focus to its control when clicked', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="apodo">Apodo</Label>
        <input id="apodo" />
      </>,
    );

    await user.click(screen.getByText('Apodo'));

    expect(screen.getByLabelText('Apodo')).toHaveFocus();
  });

  it('accepts an extra className', () => {
    render(<Label className="text-danger">Apodo</Label>);

    expect(screen.getByText('Apodo')).toHaveClass('text-danger');
  });
});
