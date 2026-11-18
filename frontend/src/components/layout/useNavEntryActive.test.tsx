import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NAV_GROUPS, isSoonEntry } from './navigation';
import type { NavLinkEntry } from './navigation';
import { useNavEntryActive } from './useNavEntryActive';

const linkEntries = NAV_GROUPS.flatMap((group) => group.entries).filter(
  (candidate): candidate is NavLinkEntry => !isSoonEntry(candidate),
);

const renderActive = (location: string) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[location]}>{children}</MemoryRouter>
  );
  return renderHook(() => useNavEntryActive(), { wrapper }).result.current;
};

/** The ids of the link entries that are active at `location`. */
const activeAt = (location: string): string[] =>
  linkEntries.filter((entry) => renderActive(location)(entry)).map((entry) => entry.id);

describe('useNavEntryActive', () => {
  it('marks only Inicio on the home page (exact match)', () => {
    expect(activeAt('/')).toEqual(['home']);
  });

  it('marks the catalogue on /items and on an item, not the owner view', () => {
    expect(activeAt('/items')).toEqual(['catalog']);
    expect(activeAt('/items/5')).toEqual(['catalog']);
  });

  it('marks only «Mis items» on /items?mine=true', () => {
    expect(activeAt('/items?mine=true')).toEqual(['my-items']);
  });

  it('treats mine=anything-else as the plain catalogue', () => {
    expect(activeAt('/items?mine=false')).toEqual(['catalog']);
  });

  it('ignores a trailing slash and the case of the path', () => {
    expect(activeAt('/items/?mine=true')).toEqual(['my-items']);
    expect(activeAt('/Items')).toEqual(['catalog']);
  });

  it('does not mistake a longer path for the catalogue', () => {
    expect(activeAt('/items-extra')).toEqual([]);
  });

  it('matches an ordinary entry as a prefix', () => {
    expect(activeAt('/colecciones/3')).toEqual(['collections']);
    expect(activeAt('/components-ui')).toEqual(['ui-components']);
  });
});
