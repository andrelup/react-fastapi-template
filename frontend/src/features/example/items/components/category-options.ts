import type { SelectOption } from '@/components/ui/Select';

export const ALL_CATEGORIES = 'all';

// The `/items` endpoint (issue #36) has no categories endpoint of its own, so
// this is a static curated list for the example domain rather than a fetched
// one — swap it for a real source once the backend exposes it.
export const CATEGORY_CHOICES: SelectOption[] = [
  { value: 'libros', label: 'Libros' },
  { value: 'musica', label: 'Música' },
  { value: 'videojuegos', label: 'Videojuegos' },
  { value: 'electronica', label: 'Electrónica' },
  { value: 'hogar', label: 'Hogar' },
];

/** The catalogue filter: the choices plus the "no filter" entry. */
export const CATEGORY_OPTIONS: SelectOption[] = [
  { value: ALL_CATEGORIES, label: 'Todas las categorías' },
  ...CATEGORY_CHOICES,
];
