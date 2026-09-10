import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Adapted from shadcn/ui `badge`. `default` keeps the pill this project
 * already used (soft green, fully rounded); the other variants are shadcn's,
 * rewritten onto the project tokens.
 */
export const badgeVariants = cva(
  'inline-flex w-fit items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors [&>svg]:size-3 [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-50 text-primary-dark',
        secondary: 'border-transparent bg-bg text-body',
        destructive: 'border-transparent bg-danger-bg text-danger',
        outline: 'border-border text-ink',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  children: ReactNode;
}

/** Generic status pill. Pure UI, no business logic. */
export const Badge = ({ children, className, variant, ...rest }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...rest}>
    {children}
  </span>
);
