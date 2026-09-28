import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from './Combobox';
import type { ComboboxOption } from './Combobox';

const options: ComboboxOption[] = [
  { value: 'red', label: 'Rojo' },
  { value: 'green', label: 'Verde' },
];

describe('Combobox', () => {
  describe('debounced search', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onSearch with the initial value on mount', () => {
      const onSearch = vi.fn();
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={vi.fn()}
          onSearch={onSearch}
        />,
      );

      expect(onSearch).toHaveBeenCalledWith('', expect.any(AbortSignal));
    });

    // `userEvent`'s per-keystroke delay deadlocks against fake timers, so
    // these follow `SearchInput.test.tsx`: `fireEvent` for the input and
    // `act(() => vi.advanceTimersByTime(...))` for the clock.
    it('does not call onSearch again before the debounce delay has elapsed', () => {
      const onSearch = vi.fn();
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={vi.fn()}
          onSearch={onSearch}
        />,
      );
      onSearch.mockClear();

      fireEvent.change(screen.getByRole('combobox', { name: 'Etiquetas' }), {
        target: { value: 'az' },
      });

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('calls onSearch once with the typed value after the pause, not per keystroke', () => {
      const onSearch = vi.fn();
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={vi.fn()}
          onSearch={onSearch}
        />,
      );
      onSearch.mockClear();

      fireEvent.change(screen.getByRole('combobox', { name: 'Etiquetas' }), {
        target: { value: 'a' },
      });
      fireEvent.change(screen.getByRole('combobox', { name: 'Etiquetas' }), {
        target: { value: 'az' },
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('az', expect.any(AbortSignal));
    });
  });

  it('derives the accessible name from the label', () => {
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Etiquetas')).toBeInTheDocument();
  });

  it('shows the chosen values as removable badges', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[{ value: 'red', label: 'Rojo' }]}
        onValueChange={onValueChange}
        onSearch={vi.fn()}
      />,
    );

    expect(screen.getByText('Rojo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar Rojo' }));

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it('selects an option from the list without calling onCreate', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onCreate = vi.fn();
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={onValueChange}
        onSearch={vi.fn()}
        allowCreate
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));
    await user.click(await screen.findByRole('option', { name: 'Verde' }));

    expect(onValueChange).toHaveBeenCalledWith([{ value: 'green', label: 'Verde' }]);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows a message when there are no options', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        label="Etiquetas"
        options={[]}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));

    expect(await screen.findByText('No se encontraron resultados.')).toBeInTheDocument();
  });

  it('shows a loading row instead of the empty message while isLoading is set', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        label="Etiquetas"
        options={[]}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
        isLoading
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));

    expect(await screen.findByText('Buscando…')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron resultados.')).not.toBeInTheDocument();
  });

  it('marks the field invalid and points at the message when there is an error', () => {
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
        error="Elige al menos una etiqueta."
      />,
    );

    const field = screen.getByRole('combobox', { name: 'Etiquetas' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Elige al menos una etiqueta.');
    expect(screen.getByText('Elige al menos una etiqueta.')).toBeInTheDocument();
  });

  it('is neither invalid nor described by anything without an error', () => {
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    const field = screen.getByRole('combobox', { name: 'Etiquetas' });
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('disables the field so it cannot be opened', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Etiquetas' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('removes the last chosen value on Backspace when the field is empty', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[{ value: 'red', label: 'Rojo' }]}
        onValueChange={onValueChange}
        onSearch={vi.fn()}
      />,
    );

    const field = screen.getByRole('combobox', { name: 'Etiquetas' });
    field.focus();
    await user.keyboard('{Backspace}');

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  describe('on-the-fly creation', () => {
    it('does not offer to create a value when allowCreate is off', async () => {
      const user = userEvent.setup();
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={vi.fn()}
          onSearch={vi.fn()}
        />,
      );

      const field = screen.getByRole('combobox', { name: 'Etiquetas' });
      await user.click(field);
      fireEvent.change(field, { target: { value: 'Amarillo' } });

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: /crear/i })).not.toBeInTheDocument();
      });
    });

    it('creates a value that is not in the list and adds it once resolved', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      let resolveCreate: (option: ComboboxOption) => void = () => {};
      const onCreate = vi.fn(
        () =>
          new Promise<ComboboxOption>((resolve) => {
            resolveCreate = resolve;
          }),
      );
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={onValueChange}
          onSearch={vi.fn()}
          allowCreate
          onCreate={onCreate}
        />,
      );

      const field = screen.getByRole('combobox', { name: 'Etiquetas' });
      await user.click(field);
      fireEvent.change(field, { target: { value: 'Amarillo' } });

      const createOption = await screen.findByRole('option', { name: /Crear «Amarillo»/ });
      await user.click(createOption);

      expect(onCreate).toHaveBeenCalledWith('Amarillo');
      expect(onValueChange).not.toHaveBeenCalled();

      await act(async () => {
        resolveCreate({ value: 'yellow', label: 'Amarillo' });
      });

      await waitFor(() => {
        expect(onValueChange).toHaveBeenCalledWith([{ value: 'yellow', label: 'Amarillo' }]);
      });
    });

    it('leaves the chip out of value when creation fails, and it stays retryable', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onCreate = vi.fn(() => Promise.reject(new Error('boom')));
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={onValueChange}
          onSearch={vi.fn()}
          allowCreate
          onCreate={onCreate}
        />,
      );

      const field = screen.getByRole('combobox', { name: 'Etiquetas' });
      await user.click(field);
      fireEvent.change(field, { target: { value: 'Amarillo' } });

      const createOption = await screen.findByRole('option', { name: /Crear «Amarillo»/ });
      await user.click(createOption);

      const retryButton = await screen.findByRole('button', {
        name: 'Reintentar creación de «Amarillo»',
      });

      expect(retryButton).toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(retryButton);

      expect(onCreate).toHaveBeenCalledTimes(2);
    });

    it('dismisses the failed creation chip without retrying', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onCreate = vi.fn(() => Promise.reject(new Error('boom')));
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[]}
          onValueChange={onValueChange}
          onSearch={vi.fn()}
          allowCreate
          onCreate={onCreate}
        />,
      );

      const field = screen.getByRole('combobox', { name: 'Etiquetas' });
      await user.click(field);
      fireEvent.change(field, { target: { value: 'Amarillo' } });

      const createOption = await screen.findByRole('option', { name: /Crear «Amarillo»/ });
      await user.click(createOption);

      const dismissButton = await screen.findByRole('button', { name: 'Quitar «Amarillo»' });
      await user.click(dismissButton);

      expect(
        screen.queryByRole('button', { name: 'Reintentar creación de «Amarillo»' }),
      ).not.toBeInTheDocument();
    });

    it('does not offer to create a value that is already selected', async () => {
      const user = userEvent.setup();
      render(
        <Combobox
          label="Etiquetas"
          options={options}
          value={[{ value: 'red', label: 'Rojo' }]}
          onValueChange={vi.fn()}
          onSearch={vi.fn()}
          allowCreate
          onCreate={vi.fn()}
        />,
      );

      const field = screen.getByRole('combobox', { name: 'Etiquetas' });
      await user.click(field);
      fireEvent.change(field, { target: { value: 'Rojo' } });

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: /crear/i })).not.toBeInTheDocument();
      });
    });
  });

  it('closes the list on Escape without discarding the chosen values', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[{ value: 'red', label: 'Rojo' }]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Etiquetas' }));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Rojo')).toBeInTheDocument();
  });

  it('flashes a success indicator after creating a value, then clears it', async () => {
    vi.useFakeTimers();
    let resolveCreate: (option: ComboboxOption) => void = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<ComboboxOption>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    render(
      <Combobox
        label="Etiquetas"
        options={options}
        value={[]}
        onValueChange={vi.fn()}
        onSearch={vi.fn()}
        allowCreate
        onCreate={onCreate}
      />,
    );

    const field = screen.getByRole('combobox', { name: 'Etiquetas' });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Amarillo' } });

    const createOption = screen.getByRole('option', { name: /Crear «Amarillo»/ });
    fireEvent.click(createOption);

    await act(async () => {
      resolveCreate({ value: 'yellow', label: 'Amarillo' });
    });

    expect(screen.getByText('«Amarillo» creado correctamente.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('«Amarillo» creado correctamente.')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
