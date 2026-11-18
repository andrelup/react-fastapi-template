import {
  FolderOpen,
  Home,
  MessageCircle,
  Package,
  Palette,
  Settings,
  Star,
  Store,
  UserPen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ITEMS_PATH, MY_ITEMS_PATH } from '@/lib/paths';

/** How an entry that shares the `/items` path decides it is active — see `useNavEntryActive`. */
export type NavActiveRule = 'catalog' | 'mine';

interface NavEntryBase {
  id: string;
  label: string;
  icon: LucideIcon;
  /** `false` for an entry the desktop `Sidebar` does not list (mobile-only). */
  sidebar?: false;
  /** Where the entry lives on mobile: a `MobileTabBar` tab, or the account panel. */
  mobile: 'tab' | 'drawer';
  /** Shorter label for the tab, when the Sidebar label does not fit under an icon. */
  tabLabel?: string;
}

/** An entry that navigates somewhere. */
export interface NavLinkEntry extends NavEntryBase {
  to: string;
  /** Match `to` exactly instead of as a prefix (only `/` needs it). */
  end?: boolean;
  active?: NavActiveRule;
  soon?: never;
}

/** An entry whose route does not exist yet: inactive, with the «Próximamente» pill, never a link. */
export interface NavSoonEntry extends NavEntryBase {
  soon: true;
  to?: never;
  end?: never;
  active?: never;
}

export type NavEntry = NavLinkEntry | NavSoonEntry;

export interface NavGroupConfig {
  id: string;
  label: string;
  /** Position of the group in the account panel; a group with no panel entries has none. */
  drawerOrder?: number;
  entries: NavEntry[];
}

export const isSoonEntry = (entry: NavEntry): entry is NavSoonEntry => entry.soon === true;

/**
 * The one description of the app's navigation. The desktop `Sidebar`, the
 * `MobileTabBar` and the `MobileAccountDrawer` all render from it, so a
 * section cannot exist on one surface and be forgotten on the other.
 * Groups and entries are listed in Sidebar order.
 *
 * - `mobile: 'tab'` entries become tabs (Inicio, and the catalogue as «Catálogo»).
 * - `mobile: 'drawer'` entries go in the account panel, under the same group heading.
 * - «Editar perfil» is panel-only (`sidebar: false`).
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'main',
    label: 'Principal',
    entries: [
      { id: 'home', label: 'Inicio', icon: Home, to: '/', end: true, mobile: 'tab' },
      {
        id: 'catalog',
        label: 'Explorar catálogo',
        tabLabel: 'Catálogo',
        icon: Store,
        to: ITEMS_PATH,
        active: 'catalog',
        mobile: 'tab',
      },
    ],
  },
  {
    id: 'collections',
    label: 'Colecciones',
    drawerOrder: 1,
    entries: [
      {
        id: 'collections',
        label: 'Ver colecciones',
        icon: FolderOpen,
        to: '/colecciones',
        mobile: 'drawer',
      },
      {
        id: 'featured-collections',
        label: 'Colecciones destacadas',
        icon: Star,
        soon: true,
        mobile: 'drawer',
      },
    ],
  },
  {
    id: 'account',
    label: 'Cuenta',
    drawerOrder: 0,
    entries: [
      {
        id: 'my-items',
        label: 'Mis items',
        icon: Package,
        to: MY_ITEMS_PATH,
        active: 'mine',
        mobile: 'drawer',
      },
      { id: 'messages', label: 'Mensajes', icon: MessageCircle, soon: true, mobile: 'drawer' },
      { id: 'settings', label: 'Ajustes', icon: Settings, soon: true, mobile: 'drawer' },
      {
        id: 'edit-profile',
        label: 'Editar perfil',
        icon: UserPen,
        soon: true,
        sidebar: false,
        mobile: 'drawer',
      },
    ],
  },
  {
    id: 'development',
    label: 'Desarrollo',
    drawerOrder: 2,
    entries: [
      {
        id: 'ui-components',
        label: 'Componentes UI',
        icon: Palette,
        to: '/components-ui',
        mobile: 'drawer',
      },
    ],
  },
];

const withEntries = (
  groups: NavGroupConfig[],
  keep: (entry: NavEntry) => boolean,
): NavGroupConfig[] =>
  groups
    .map((group) => ({ ...group, entries: group.entries.filter(keep) }))
    .filter((group) => group.entries.length > 0);

/** What the desktop `Sidebar` lists. */
export const SIDEBAR_GROUPS = withEntries(NAV_GROUPS, (entry) => entry.sidebar !== false);

/** What the account panel lists, in panel order. */
export const DRAWER_GROUPS = withEntries(NAV_GROUPS, (entry) => entry.mobile === 'drawer').sort(
  (a, b) => (a.drawerOrder ?? 0) - (b.drawerOrder ?? 0),
);

/** The `MobileTabBar` tabs that navigate, in order. */
export const TAB_ENTRIES: NavLinkEntry[] = NAV_GROUPS.flatMap((group) => group.entries).filter(
  (entry): entry is NavLinkEntry => entry.mobile === 'tab' && !isSoonEntry(entry),
);
