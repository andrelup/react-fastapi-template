import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { InputControl } from '@/components/ui/InputControl';
import { Label } from '@/components/ui/Label';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  label: string;
  placeholder?: string;
  /** Called with the debounced value — on mount, and again after each pause in typing. */
  onSearch: (value: string) => void;
  delayMs?: number;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * `Input` married to the existing `useDebounce` hook: keeps the field
 * responsive to every keystroke while only calling `onSearch` once typing
 * pauses for `delayMs`. Pure UI — it debounces, it does not fetch.
 */
export const SearchInput = ({
  label,
  placeholder = 'Buscar…',
  onSearch,
  delayMs = 300,
  defaultValue = '',
  disabled = false,
  className,
}: SearchInputProps) => {
  const [value, setValue] = useState(defaultValue);
  const debouncedValue = useDebounce(value, delayMs);
  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  // Kept in a ref so a caller passing a fresh `onSearch` closure on every
  // render does not itself retrigger the effect below.
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    onSearchRef.current(debouncedValue);
  }, [debouncedValue]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <InputControl
          id={inputId}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          className={cn('pl-9', className)}
        />
      </div>
    </div>
  );
};
