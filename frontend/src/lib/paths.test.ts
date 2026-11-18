import { describe, expect, it } from 'vitest';
import { ITEMS_PATH, MY_ITEMS_PATH, isMineView } from './paths';

describe('paths', () => {
  it('builds the owner view from the catalogue path', () => {
    expect(MY_ITEMS_PATH).toBe(`${ITEMS_PATH}?mine=true`);
  });

  it('recognises the query string of its own link as the owner view', () => {
    const query = MY_ITEMS_PATH.split('?')[1];

    expect(isMineView(new URLSearchParams(query))).toBe(true);
  });

  it.each(['', 'mine=false', 'mine=1', 'mine=TRUE', 'other=true'])(
    'does not treat "%s" as the owner view',
    (query) => {
      expect(isMineView(new URLSearchParams(query))).toBe(false);
    },
  );
});
