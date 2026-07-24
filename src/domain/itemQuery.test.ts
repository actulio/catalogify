import { applyQuery, Filters, SortSpec, computeStats } from './itemQuery';
import { CatalogItem, FieldDef } from './types';

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
  item({ id: 'a', title: 'Ethiopia Yirgacheffe', values: { rating: 9, price: 40, decaf: false, opened: 1000 }, createdAt: 300 }),
  item({ id: 'b', title: 'Brazil Santos', values: { rating: 6, price: 25, decaf: true, opened: 2000 }, createdAt: 200 }),
  item({ id: 'c', title: 'Colombia Huila', values: { rating: 8, price: 32, decaf: false, opened: 3000 }, createdAt: 100 }),
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

  it('dateRange filters a date field value inclusive', () => {
    const filters: Filters = { opened: { kind: 'dateRange', from: 1500, to: 2500 } };
    expect(applyQuery(items, { filters }).map((i) => i.id)).toEqual(['b']);
  });

  it('dateRange excludes items missing the date value', () => {
    const noDate = item({ id: 'd', title: 'No date', values: { rating: 5 } });
    const filters: Filters = { opened: { kind: 'dateRange', from: 0, to: 9999 } };
    expect(applyQuery([...items, noDate], { filters }).map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('range filter excludes items with a missing/non-numeric value', () => {
    const noPrice = item({ id: 'd', title: 'No price', values: { rating: 5 } });
    const filters: Filters = { price: { kind: 'range', min: 0 } };
    expect(applyQuery([...items, noPrice], { filters }).map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('boolean filter excludes items missing the field', () => {
    const noDecaf = item({ id: 'd', title: 'No decaf', values: { rating: 5 } });
    const filters: Filters = { decaf: { kind: 'boolean', value: false } };
    // a and c have decaf:false; d has no decaf value and must NOT match value:false
    expect(applyQuery([...items, noDecaf], { filters }).map((i) => i.id).sort()).toEqual(['a', 'c']);
  });
});

describe('applyQuery — sort', () => {
  const sortIds = (sort: SortSpec) => applyQuery(items, { sort }).map((i) => i.id);

  it('sorts by dateAdded desc (newest first)', () => {
    expect(sortIds({ field: { kind: 'dateAdded' }, direction: 'desc' })).toEqual(['a', 'b', 'c']);
  });

  it('sorts by dateAdded asc', () => {
    expect(sortIds({ field: { kind: 'dateAdded' }, direction: 'asc' })).toEqual(['c', 'b', 'a']);
  });

  it('sorts by title A-Z', () => {
    expect(sortIds({ field: { kind: 'title' }, direction: 'asc' })).toEqual(['b', 'c', 'a']);
  });

  it('sorts by a numeric field desc', () => {
    expect(sortIds({ field: { kind: 'field', key: 'price' }, direction: 'desc' })).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the input array', () => {
    const before = items.map((i) => i.id);
    applyQuery(items, { sort: { field: { kind: 'field', key: 'rating' }, direction: 'asc' } });
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

const fields: FieldDef[] = [
  { key: 'rating', label: 'Rating', type: 'rating', required: false, ratingScale: { max: 10 } },
  { key: 'price', label: 'Price', type: 'number', required: false },
  { key: 'decaf', label: 'Decaf', type: 'boolean', required: false },
  { key: 'notes', label: 'Notes', type: 'longText', required: false },
];

describe('computeStats', () => {
  it('counts total items', () => {
    expect(computeStats(items, fields).total).toBe(3);
  });

  it('computes rating average and number min/max', () => {
    const stats = computeStats(items, fields);
    const rating = stats.fields.find((f) => f.key === 'rating');
    const price = stats.fields.find((f) => f.key === 'price');
    expect(rating).toMatchObject({ type: 'rating', average: (9 + 6 + 8) / 3 });
    expect(price).toMatchObject({ type: 'number', min: 25, max: 40, average: (40 + 25 + 32) / 3 });
  });

  it('counts boolean yes/no', () => {
    const decaf = computeStats(items, fields).fields.find((f) => f.key === 'decaf');
    expect(decaf).toMatchObject({ type: 'boolean', yes: 1, no: 2 });
  });

  it('ignores non-summarisable field types (text)', () => {
    expect(computeStats(items, fields).fields.some((f) => f.key === 'notes')).toBe(false);
  });

  it('returns null averages for an empty set', () => {
    const rating = computeStats([], fields).fields.find((f) => f.key === 'rating');
    expect(rating).toMatchObject({ average: null });
  });

  it('boolean stats ignore items missing the field', () => {
    const noDecaf = item({ id: 'd', title: 'No decaf', values: { rating: 5 } });
    const decaf = computeStats([...items, noDecaf], fields).fields.find((f) => f.key === 'decaf');
    // 3 items have decaf set (1 true, 2 false); the 4th (missing) is ignored
    expect(decaf).toMatchObject({ type: 'boolean', yes: 1, no: 2 });
  });
});
