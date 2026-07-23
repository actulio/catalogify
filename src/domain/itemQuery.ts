import { CatalogItem, FieldDef } from './types';

export interface RangeFilter {
  kind: 'range';
  min?: number;
  max?: number;
}
export interface BooleanFilter {
  kind: 'boolean';
  value: boolean;
}
export interface DateRangeFilter {
  kind: 'dateRange';
  from?: number; // ms epoch, inclusive
  to?: number; // ms epoch, inclusive
}
export type Filter = RangeFilter | BooleanFilter | DateRangeFilter;

// Keyed by field.key. A dateRange filter (there is at most one per catalog) uses
// the reserved key "__date" and matches against item.createdAt.
export type Filters = Record<string, Filter>;

export const DATE_FILTER_KEY = '__date';

export interface ItemQuerySpec {
  searchText?: string;
  filters?: Filters;
}

function matchesSearch(item: CatalogItem, needle: string): boolean {
  if (item.title.toLowerCase().includes(needle)) return true;
  return Object.values(item.values).some(
    (v) => typeof v === 'string' && v.toLowerCase().includes(needle)
  );
}

function matchesFilter(item: CatalogItem, key: string, filter: Filter): boolean {
  if (filter.kind === 'dateRange') {
    const t = item.createdAt;
    if (filter.from !== undefined && t < filter.from) return false;
    if (filter.to !== undefined && t > filter.to) return false;
    return true;
  }
  const value = item.values[key];
  if (filter.kind === 'range') {
    const n = Number(value ?? NaN);
    if (Number.isNaN(n)) return false;
    if (filter.min !== undefined && n < filter.min) return false;
    if (filter.max !== undefined && n > filter.max) return false;
    return true;
  }
  // boolean
  return Boolean(value) === filter.value;
}

export function applyQuery(items: CatalogItem[], spec: ItemQuerySpec): CatalogItem[] {
  let result = items;

  const needle = spec.searchText?.trim().toLowerCase();
  if (needle) {
    result = result.filter((i) => matchesSearch(i, needle));
  }

  if (spec.filters) {
    for (const [key, filter] of Object.entries(spec.filters)) {
      result = result.filter((i) => matchesFilter(i, key, filter));
    }
  }

  return result;
}
