import { describe, expect, it } from 'vitest';
import { MY_ITEMS_PATH } from '@/lib/paths';
import { DRAWER_GROUPS, NAV_GROUPS, SIDEBAR_GROUPS, TAB_ENTRIES, isSoonEntry } from './navigation';

const labels = (groups: typeof NAV_GROUPS) =>
  groups.flatMap((group) => group.entries.map((entry) => entry.label));

describe('navigation config', () => {
  it('lists the Sidebar groups in order', () => {
    expect(SIDEBAR_GROUPS.map((group) => group.label)).toEqual([
      'Principal',
      'Colecciones',
      'Cuenta',
      'Desarrollo',
    ]);
  });

  it('keeps «Editar perfil» out of the Sidebar but in the panel', () => {
    expect(labels(SIDEBAR_GROUPS)).not.toContain('Editar perfil');
    expect(labels(DRAWER_GROUPS)).toContain('Editar perfil');
  });

  it('orders the panel Cuenta, Colecciones, Desarrollo, with no Principal group', () => {
    expect(DRAWER_GROUPS.map((group) => group.label)).toEqual([
      'Cuenta',
      'Colecciones',
      'Desarrollo',
    ]);
  });

  it('puts Inicio and the catalogue on the tab bar, the catalogue as «Catálogo»', () => {
    expect(TAB_ENTRIES.map((entry) => entry.tabLabel ?? entry.label)).toEqual([
      'Inicio',
      'Catálogo',
    ]);
    expect(labels(DRAWER_GROUPS)).not.toContain('Inicio');
    expect(labels(DRAWER_GROUPS)).not.toContain('Explorar catálogo');
  });

  it('keeps every entry of the Sidebar either in a tab or in the panel', () => {
    const mobile = [...TAB_ENTRIES.map((entry) => entry.label), ...labels(DRAWER_GROUPS)];

    labels(SIDEBAR_GROUPS).forEach((label) => expect(mobile).toContain(label));
  });

  it('links «Mis items» to the owner view and leaves unbuilt sections inactive', () => {
    const entries = NAV_GROUPS.flatMap((group) => group.entries);
    const mine = entries.find((entry) => entry.label === 'Mis items');

    expect(mine && !isSoonEntry(mine) && mine.to).toBe(MY_ITEMS_PATH);
    ['Mensajes', 'Ajustes', 'Editar perfil', 'Colecciones destacadas'].forEach((label) => {
      const entry = entries.find((candidate) => candidate.label === label);
      expect(entry && isSoonEntry(entry)).toBe(true);
    });
  });

  it('gives every entry a distinct id', () => {
    const ids = NAV_GROUPS.flatMap((group) => group.entries.map((entry) => entry.id));

    expect(new Set(ids).size).toBe(ids.length);
  });
});
