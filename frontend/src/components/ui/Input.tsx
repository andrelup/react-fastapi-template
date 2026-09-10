import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { InputControl } from '@/components/ui/InputControl';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Labelled field: a `Label` plus an `InputControl`, wired together. The label
 * is mandatory and always rendered — that is what keeps forms reachable by
 * `getByLabelText` — and `error` drives `aria-invalid` / `aria-describedby`.
 * A `type="password"` field gets a reveal toggle for free.
 */
export const Input = ({ label, error, id, className, type, ...rest }: InputProps) => {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const isPassword = type === 'password';
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <InputControl
          id={inputId}
          type={isPassword ? (isRevealed ? 'text' : 'password') : type}
          className={cn(isPassword && 'pr-10', error !== undefined && 'border-danger', className)}
          aria-invalid={error !== undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsRevealed((prev) => !prev)}
            aria-label={isRevealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={isRevealed}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            {isRevealed ? (
              <EyeOff className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
