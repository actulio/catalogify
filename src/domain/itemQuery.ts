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

export type SortField =
  | { kind: 'dateAdded' }
  | { kind: 'title' }
  | { kind: 'field'; key: string }; // a rating or number field
export interface SortSpec {
  field: SortField;
  direction: 'asc' | 'desc';
}

export interface ItemQuerySpec {
  searchText?: string;
  filters?: Filters;
  sort?: SortSpec;
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

  if (spec.sort) {
    const { field, direction } = spec.sort;
    const dir = direction === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      let cmp: number;
      if (field.kind === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (field.kind === 'dateAdded') {
        cmp = a.createdAt - b.createdAt;
      } else {
        cmp = Number(a.values[field.key] ?? 0) - Number(b.values[field.key] ?? 0);
      }
      return cmp * dir;
    });
  }

  return result;
}

export interface RatingStat {
  key: string;
  label: string;
  type: 'rating';
  count: number;
  average: number | null;
  distribution: Record<number, number>;
}
export interface NumberStat {
  key: string;
  label: string;
  type: 'number';
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
}
export interface BooleanStat {
  key: string;
  label: string;
  type: 'boolean';
  yes: number;
  no: number;
}
export type FieldStat = RatingStat | NumberStat | BooleanStat;

export interface CatalogStatsData {
  total: number;
  fields: FieldStat[];
}

function numericValues(items: CatalogItem[], key: string): number[] {
  return items
    .map((i) => i.values[key])
    .filter((v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)))
    .map((v) => Number(v));
}

export function computeStats(items: CatalogItem[], fields: FieldDef[]): CatalogStatsData {
  const stats: FieldStat[] = [];

  for (const field of fields) {
    if (field.type === 'rating' || field.type === 'number') {
      const nums = numericValues(items, field.key);
      const count = nums.length;
      const average = count ? nums.reduce((s, n) => s + n, 0) / count : null;
      if (field.type === 'rating') {
        const distribution: Record<number, number> = {};
        for (const n of nums) {
          const bucket = Math.round(n);
          distribution[bucket] = (distribution[bucket] ?? 0) + 1;
        }
        stats.push({ key: field.key, label: field.label, type: 'rating', count, average, distribution });
      } else {
        stats.push({
          key: field.key,
          label: field.label,
          type: 'number',
          count,
          average,
          min: count ? Math.min(...nums) : null,
          max: count ? Math.max(...nums) : null,
        });
      }
    } else if (field.type === 'boolean') {
      let yes = 0;
      let no = 0;
      for (const i of items) {
        if (i.values[field.key] === true) yes += 1;
        else no += 1;
      }
      stats.push({ key: field.key, label: field.label, type: 'boolean', yes, no });
    }
  }

  return { total: items.length, fields: stats };
}
