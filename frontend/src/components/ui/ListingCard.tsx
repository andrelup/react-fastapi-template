import type { ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface ListingCardProps {
  title: string;
  description?: string;
  coverUrl?: string;
  /** Ignored when there is no `coverUrl` — the placeholder is decorative. */
  coverAlt?: string;
  /** A `Badge`, typically — rendered above the title. */
  badge?: ReactNode;
  /** Secondary facts (price, owner, item count…), rendered under the title. */
  meta?: ReactNode;
  /** Row of `Button`s — kept outside the clickable title so it never nests a button in a button. */
  actions?: ReactNode;
  onSelect?: () => void;
  className?: string;
}

/**
 * The project's own — shadcn/ui has no catalogue card. One surface
 * (`Card`, unchanged) composed for a listing: an optional cover, a title
 * that is the click target when `onSelect` is given, optional meta and an
 * actions row. Shared by the items and collections listing screens
 * (issues #39-#43); no domain type or data fetching lives here.
 */
export const ListingCard = ({
  title,
  description,
  coverUrl,
  coverAlt = '',
  badge,
  meta,
  actions,
  onSelect,
  className,
}: ListingCardProps) => (
  <Card className={cn('flex flex-col overflow-hidden', className)}>
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-bg">
      {coverUrl ? (
        <img src={coverUrl} alt={coverAlt} className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
      )}
    </div>
    <CardHeader>
      {badge}
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="rounded-sm text-left focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <CardTitle>{title}</CardTitle>
        </button>
      ) : (
        <CardTitle>{title}</CardTitle>
      )}
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    {meta && <CardContent className="pt-0 text-sm text-body">{meta}</CardContent>}
    {actions && <CardFooter>{actions}</CardFooter>}
  </Card>
);
