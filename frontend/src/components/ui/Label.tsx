import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

/**
 * Adapted from shadcn/ui `label` (Radix `Label`). Typography rewritten onto
 * the project tokens. `Input` already renders its own label, so reach for this
 * only when building a field that `Input` does not cover.
 */
export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-[13px] font-semibold leading-none text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));

Label.displayName = 'Label';
