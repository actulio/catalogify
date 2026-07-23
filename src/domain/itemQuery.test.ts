import { applyQuery, Filters } from './itemQuery';
import { CatalogItem } from './types';

function item(partial: Partial<CatalogItem> & { id: string }): CatalogItem {
  return {
    listId: 'L',
    title: '',
    values: {},
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const items: CatalogItem[] = [
  item({ id: 'a', title: 'Ethiopia Yirgacheffe', values: { rating: 9, price: 40, decaf: false }, createdAt: 300 }),
  item({ id: 'b', title: 'Brazil Santos', values: { rating: 6, price: 25, decaf: true }, createdAt: 200 }),
  item({ id: 'c', title: 'Colombia Huila', values: { rating: 8, price: 32, decaf: false }, createdAt: 100 }),
];

describe('applyQuery — search', () => {
  it('matches title case-insensitively', () => {
    const r = applyQuery(items, { searchText: 'brazil' });
    expect(r.map((i) => i.id)).toEqual(['b']);
  });

  it('returns all when search is empty/whitespace', () => {
    expect(applyQuery(items, { searchText: '  ' })).toHaveLength(3);
  });
});

describe('applyQuery — filters', () => {
  it('rating range filters min inclusive', () => {
    const filters: Filters = { rating: { kind: 'range', min: 8 } };
    expect(applyQuery(items, { filters }).map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('number range filters max inclusive', () => {
    const filters: Filters = { price: { kind: 'range', max: 30 } };
    expect(applyQuery(items, { filters }).map((i) => i.id)).toEqual(['b']);
  });

  it('boolean filter matches exact value', () => {
    const filters: Filters = { decaf: { kind: 'boolean', value: true } };
    expect(applyQuery(items, { filters }).map((i) => i.id)).toEqual(['b']);
  });

  it('multiple filters combine with AND', () => {
    const filters: Filters = {
      rating: { kind: 'range', min: 7 },
      decaf: { kind: 'boolean', value: false },
    };
    expect(applyQuery(items, { filters }).map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('dateRange filters on createdAt inclusive', () => {
    const filters: Filters = { __date: { kind: 'dateRange', from: 150, to: 250 } };
    expect(applyQuery(items, { filters }).map((i) => i.id)).toEqual(['b']);
  });
});
