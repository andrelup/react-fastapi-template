import { getInitials } from '@/utils/get-initials';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
};

/** Generic circular avatar showing a person's initials. Pure UI, no business logic. */
export const Avatar = ({ name, size = 'md', className = '' }: AvatarProps) => (
  <div
    role="img"
    aria-label={name}
    className={`flex items-center justify-center rounded-full bg-primary font-serif font-bold text-white ${sizeClasses[size]} ${className}`}
  >
    {getInitials(name)}
  </div>
);
