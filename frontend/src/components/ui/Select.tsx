import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  error?: string;
  id?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  name?: string;
  className?: string;
}

/**
 * Adapted from shadcn/ui `select` (Radix `Select`), wrapped to carry the same
 * contract as `Input`: a mandatory `label`, an `id` derived from it when not
 * supplied, and `error` wired through `aria-invalid` / `aria-describedby`
 * onto the trigger, which is the field's focusable control.
 */
export const Select = ({
  label,
  error,
  id,
  placeholder = 'Selecciona una opción',
  options,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  isLoading = false,
  name,
  className,
}: SelectProps) => {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled || isLoading}
        name={name}
      >
        <SelectPrimitive.Trigger
          id={selectId}
          aria-invalid={error !== undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded border border-input bg-surface px-[13px] py-[11px] text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted',
            error !== undefined && 'border-danger',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={isLoading ? 'Cargando…' : placeholder} />
          <SelectPrimitive.Icon asChild>
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            )}
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="relative z-50 max-h-96 min-w-[--radix-select-trigger-width] overflow-hidden rounded-md border border-border bg-surface text-ink shadow-float"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted">No hay opciones disponibles.</p>
              ) : (
                options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-primary-50 focus:text-primary-dark data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
