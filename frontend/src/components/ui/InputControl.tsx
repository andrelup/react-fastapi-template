import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Adapted from shadcn/ui `input`: the bare, unlabelled `<input>` with the
 * project's field styling. Not meant to be used directly by feature or screen
 * code — use `Input`, which pairs it with a `Label` and the error wiring.
 */
export const InputControl = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex w-full rounded border border-input bg-surface py-[11px] pl-[13px] pr-[13px] text-sm text-ink transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

InputControl.displayName = 'InputControl';
