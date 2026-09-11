import type { TextareaHTMLAttributes } from 'react';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

/**
 * Adapted from shadcn/ui `textarea`. Mirrors `Input`'s contract: the `label`
 * is mandatory and always rendered, the `id` is derived from it when not
 * supplied, and `error` drives `aria-invalid` / `aria-describedby` plus the
 * same error message element.
 */
export const Textarea = ({ label, error, id, className, ...rest }: TextareaProps) => {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={textareaId}>{label}</Label>
      <textarea
        id={textareaId}
        className={cn(
          'flex min-h-[96px] w-full rounded border border-input bg-surface px-[13px] py-[11px] text-sm text-ink transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          error !== undefined && 'border-danger',
          className,
        )}
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${textareaId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
