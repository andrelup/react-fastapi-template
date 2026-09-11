import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { getInitials } from '@/utils/get-initials';
import { cn } from '@/lib/utils';

interface AvatarProps {
  /** Full name: drives both the initials in the fallback and the accessible name. */
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Optional picture. While it loads, or if it fails, the initials are shown. */
  src?: string;
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
};

/**
 * Circular avatar built on shadcn/ui `avatar` (Radix `Avatar`). The project
 * contract (`name` + `size`, `role="img"` with the name as accessible name) is
 * kept; the image is decorative because the root already carries the label.
 */
export const Avatar = ({ name, size = 'md', src, className }: AvatarProps) => (
  <AvatarPrimitive.Root
    role="img"
    aria-label={name}
    className={cn(
      'relative flex shrink-0 overflow-hidden rounded-full',
      sizeClasses[size],
      className,
    )}
  >
    {src !== undefined && (
      <AvatarPrimitive.Image src={src} alt="" className="aspect-square h-full w-full" />
    )}
    <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-primary font-serif font-bold text-primary-foreground">
      {getInitials(name)}
    </AvatarPrimitive.Fallback>
  </AvatarPrimitive.Root>
);
