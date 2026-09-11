import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

/**
 * Bespoke: shadcn/ui has no spinner primitive, so this one stays hand-written
 * on the project tokens. Used as the Suspense fallback and as an inline
 * loading placeholder.
 */
export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
  <div
    role="status"
    aria-label="Cargando"
    className={cn(
      'animate-spin rounded-full border-primary-50 border-t-primary',
      sizeClasses[size],
      className,
    )}
  />
);
