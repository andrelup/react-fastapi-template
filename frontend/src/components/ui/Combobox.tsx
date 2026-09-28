import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertTriangle, Check, Plus, X } from 'lucide-react';
import { badgeVariants } from '@/components/ui/Badge';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/Command';
import { Label } from '@/components/ui/Label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// `Combobox` is NOT a copy from shadcn/ui — shadcn's own Combobox page is a
// composition recipe over `Command` + `Popover`, not a registry entry — so
// it does not fall under the "only class strings and copy" restriction that
// applies to those two files. This is ordinary project code, held to the
// same standard as any other component in this codebase.

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  label: string;
  error?: string;
  id?: string;
  placeholder?: string;
  options: ComboboxOption[];
  /** Confirmed values only — a failed on-the-fly creation never appears here. */
  value: ComboboxOption[];
  onValueChange: (value: ComboboxOption[]) => void;
  /**
   * Called with the debounced query — on mount, and again after each pause in
   * typing. Pure UI — it debounces, it does not fetch. The `AbortSignal` is
   * aborted the moment a newer query supersedes this one (or the component
   * unmounts), so a caller that forwards it to `fetch` gets stale-response
   * cancellation for free instead of having to build its own request counter.
   */
  onSearch: (query: string, signal: AbortSignal) => void;
  delayMs?: number;
  isLoading?: boolean;
  disabled?: boolean;
  /** Turns on-the-fly creation on. Off by default: not every consumer wants it. */
  allowCreate?: boolean;
  onCreate?: (name: string) => Promise<ComboboxOption>;
  emptyMessage?: string;
  className?: string;
}

type CreationStatus = 'pending' | 'success' | 'error';

interface Creation {
  label: string;
  status: CreationStatus;
}

const CREATE_ITEM_VALUE = '__combobox-create__';
const ICON_BUTTON_CLASSES =
  'rounded-full focus:outline-none focus-visible:ring-[2px] focus-visible:ring-ring';

/**
 * A multi-value, searchable field built on `Command` (cmdk) and `Popover`,
 * for the cases `Select` does not cover: several values at once, a list that
 * is rebuilt while the user types, and the option to add a value that does
 * not exist yet. Carries the same contract as `Input` and `Select` — a
 * mandatory `label`, `error` wired to `aria-invalid` / `aria-describedby` on
 * the focusable control — with one documented gap: cmdk's `CommandInput`
 * generates its own DOM `id` and points its own `aria-labelledby` at a hidden
 * `<label>` it renders internally from `Command`'s `label` prop, so the `id`
 * this component derives from `label` is not the one that ends up on the
 * input. The accessible name still equals `label` — `getByLabelText` and
 * `getByRole('combobox', { name: label })` both resolve correctly — only the
 * literal DOM `id` is not caller-controlled, which is why the visible `Label`
 * below is not wired through `htmlFor`.
 *
 * The search itself is entirely the caller's: this component only paints the
 * `options` and `isLoading` it is given, and disables cmdk's own client-side
 * filtering (`shouldFilter={false}`) so a list that already came back
 * filtered from the server is not filtered a second time on top of it.
 */
export const Combobox = ({
  label,
  error,
  id,
  placeholder = 'Buscar…',
  options,
  value,
  onValueChange,
  onSearch,
  delayMs = 300,
  isLoading = false,
  disabled = false,
  allowCreate = false,
  onCreate,
  emptyMessage = 'No se encontraron resultados.',
  className,
}: ComboboxProps) => {
  const comboboxId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creation, setCreation] = useState<Creation | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, delayMs);

  // Kept in refs so a caller passing fresh closures on every render does not
  // retrigger the search effect, and so the promise in `createValue` always
  // acts on the latest `value` even if it changes while the promise is in
  // flight — the same idiom `SearchInput` uses for `onSearch`.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Discards stale responses: a fresh `AbortController` is created for every
  // debounced query, and the previous one is aborted — either because this
  // effect re-runs for a newer query, or because the component unmounts.
  // A caller that forwards `signal` to `fetch` gets the previous request
  // cancelled for free, instead of having to keep its own request counter.
  useEffect(() => {
    const controller = new AbortController();
    onSearchRef.current(debouncedQuery, controller.signal);
    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const visibleOptions = options.filter(
    (option) => !value.some((selected) => selected.value === option.value),
  );
  const hasExactMatch =
    normalizedQuery === '' ||
    visibleOptions.some((option) => option.label.trim().toLowerCase() === normalizedQuery) ||
    value.some((option) => option.label.trim().toLowerCase() === normalizedQuery);
  const isCreating = creation?.status === 'pending';
  const showCreateRow =
    allowCreate &&
    Boolean(onCreate) &&
    trimmedQuery !== '' &&
    !hasExactMatch &&
    !isLoading &&
    !isCreating;

  const handleSelect = (option: ComboboxOption) => {
    onValueChange([...value, option]);
    setQuery('');
  };

  const handleRemove = (option: ComboboxOption) => {
    if (disabled) return;
    onValueChange(value.filter((selected) => selected.value !== option.value));
  };

  const createValue = (name: string) => {
    const create = onCreateRef.current;
    if (!create || isCreating) return;

    setCreation({ label: name, status: 'pending' });
    setQuery('');

    create(name)
      .then((created) => {
        onValueChangeRef.current([...valueRef.current, created]);
        setCreation({ label: name, status: 'success' });
        window.setTimeout(() => {
          setCreation((current) =>
            current?.label === name && current.status === 'success' ? null : current,
          );
        }, 1500);
      })
      .catch(() => {
        setCreation({ label: name, status: 'error' });
      });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && query === '' && value.length > 0) {
      onValueChange(value.slice(0, -1));
    }
  };

  const openIfEnabled = () => {
    if (!disabled) setOpen(true);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Popover open={disabled ? false : open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <Command
          shouldFilter={false}
          label={label}
          className="flex h-auto w-full flex-col overflow-visible rounded-none bg-transparent text-ink"
        >
          <PopoverAnchor asChild>
            <div
              onClick={() => {
                openIfEnabled();
                inputRef.current?.focus();
              }}
              className={cn(
                'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded border border-input bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring',
                error !== undefined && 'border-danger',
                disabled && 'cursor-not-allowed opacity-50',
                className,
              )}
            >
              {value.map((option) => (
                <span
                  key={option.value}
                  className={cn(badgeVariants({ variant: 'default' }), 'gap-1 pr-1')}
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(option);
                    }}
                    disabled={disabled}
                    aria-label={`Quitar ${option.label}`}
                    className={ICON_BUTTON_CLASSES}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}

              {creation && creation.status !== 'success' && (
                <span
                  className={cn(
                    // `warning`, not `destructive`: a creation that failed is not a
                    // destructive action, and §1 reserves red for those. While it is
                    // still in flight the chip stays neutral — nothing has gone wrong
                    // yet.
                    badgeVariants({
                      variant: creation.status === 'pending' ? 'secondary' : 'warning',
                    }),
                    'gap-1 pr-1',
                  )}
                >
                  {creation.status === 'pending' ? (
                    <>
                      <Spinner size="sm" />
                      {creation.label}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          createValue(creation.label);
                        }}
                        aria-label={`Reintentar creación de «${creation.label}»`}
                        className={cn(ICON_BUTTON_CLASSES, 'rounded-sm')}
                      >
                        {creation.label}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCreation(null);
                        }}
                        aria-label={`Quitar «${creation.label}»`}
                        className={ICON_BUTTON_CLASSES}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </span>
              )}

              <CommandInput
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                onFocus={openIfEnabled}
                onKeyDown={handleInputKeyDown}
                disabled={disabled}
                placeholder={value.length === 0 && !creation ? placeholder : undefined}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${comboboxId}-error` : undefined}
                className="h-7 min-w-[120px] flex-1 border-none p-0 text-sm"
              />

              <div className="ml-auto flex items-center pl-2">
                {creation?.status === 'pending' && <Spinner size="sm" />}
                {creation?.status === 'success' && (
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                )}
                {creation?.status === 'error' && (
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                )}
                <span className="sr-only" role="status">
                  {creation?.status === 'pending' && `Creando «${creation.label}»…`}
                  {creation?.status === 'success' && `«${creation.label}» creado correctamente.`}
                  {creation?.status === 'error' && `No se pudo crear «${creation.label}».`}
                </span>
              </div>
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="w-[--radix-popover-trigger-width] p-0"
          >
            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted">
                  <Spinner size="sm" />
                  Buscando…
                </div>
              ) : (
                <>
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                  {visibleOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option)}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                  {showCreateRow && (
                    <CommandItem
                      value={CREATE_ITEM_VALUE}
                      onSelect={() => createValue(trimmedQuery)}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Crear «{trimmedQuery}»
                    </CommandItem>
                  )}
                </>
              )}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
      {error && (
        <p id={`${comboboxId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
