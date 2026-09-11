import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Adapted from shadcn/ui `button`. Only the class strings changed: shadcn's
 * own palette is replaced by the project tokens, and `destructive` keeps the
 * project's ghost-red treatment (border and text, never a solid red fill),
 * because here red is reserved for destructive actions.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-primary-100',
        destructive: 'border border-danger-border bg-transparent text-danger hover:bg-danger-bg',
        outline: 'border border-primary-100 bg-surface text-primary hover:bg-primary-50',
        ghost: 'text-body hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-5 py-3 text-[15px]',
        sm: 'px-3 py-2 text-sm',
        lg: 'px-7 py-3.5 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  children: ReactNode;
  /** Renders the single child element with the button styles instead of a `<button>`. */
  asChild?: boolean;
  /** Disables the button and replaces its content with a loading label. */
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, className, variant, size, asChild = false, isLoading = false, disabled, ...rest },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? isLoading}
        {...rest}
      >
        {isLoading ? 'Cargando…' : children}
      </Comp>
    );
  },
);

Button.displayName = 'Button';
