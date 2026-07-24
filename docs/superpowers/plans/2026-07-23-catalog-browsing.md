# Catalog Browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only item detail screen, type-aware filter + generalized sort, and filter-aware per-catalog stats, backed by a client-side query module and app-wide React Query caching.

**Architecture:** A pure module `domain/itemQuery.ts` filters/sorts items and computes stats in memory. Screens fetch all items for a catalog through React Query (`useItems`) and feed them to that module. Mutations invalidate the cached query so views stay fresh. No Firestore query changes.

**Tech Stack:** Expo / React Native, TypeScript, NativeWind, `@tanstack/react-query`, Firestore (via existing `FirebaseCatalogRepository`), Jest (`jest-expo`, `npm test`).

**Reference spec:** `docs/superpowers/specs/2026-07-23-catalog-browsing-design.md`

**Conventions:**
- Run pure-logic tests with `npm test` (the `app` Jest project). New tests live beside their module as `*.test.ts`.
- Do NOT run `test:emulator` (needs the Firebase emulator); this plan does not change repo behavior.
- Type-check with `npx tsc --noEmit`.
- Commit after every task.

---

## File Structure

| File | Responsibility | New? |
|---|---|---|
| `src/domain/itemQuery.ts` | Pure `applyQuery` (search + filters + sort) and `computeStats`. All browsing logic. | new |
| `src/domain/itemQuery.test.ts` | Unit tests for the above. | new |
| `src/services/queryClient.ts` | Configured `QueryClient` singleton. | new |
| `src/hooks/useCatalogQueries.ts` | React Query keys + `useItems`, `useLists`, `useItemCounts`, `useInvalidateCatalog`. | new |
| `src/components/FilterSortSheet.tsx` | Bottom sheet: Sort-by + type-aware filters + Clear all. | new |
| `src/components/CatalogStats.tsx` | Collapsible, filter-aware stats strip. | new |
| `src/screens/ItemDetailScreen.tsx` | Read-only item view; Edit + Delete; hides empty fields. | new |
| `App.tsx` | Wrap tree in `QueryClientProvider`. | modify |
| `src/navigation/RootNavigator.tsx` | Add `ItemDetail` route. | modify |
| `src/screens/ListDetailScreen.tsx` | Search + Filter&sort button + sheet + stats; item tap → `ItemDetail`; read via `useItems`. | modify |
| `src/screens/HomeScreen.tsx` | Read lists + counts via React Query. | modify |
| `src/screens/ItemFormScreen.tsx` | Invalidate cached items after save/delete. | modify |

---

## Task 1: Install React Query and add the provider

**Files:**
- Modify: `package.json` (dependency added by npm)
- Create: `src/services/queryClient.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Install the library**

Run: `npm install @tanstack/react-query`
Expected: adds `@tanstack/react-query` to `dependencies`, no peer-dep errors.

- [ ] **Step 2: Create the QueryClient**

Create `src/services/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

// staleTime keeps re-focusing a screen from refetching immediately; all writes go
// through mutations that invalidate the relevant keys, so data still stays fresh.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
```

- [ ] **Step 3: Wrap the app tree**

In `App.tsx`, import the provider and client, and wrap the existing root element (the outermost returned component, inside any font-loading guard) with `<QueryClientProvider client={queryClient}>...</QueryClientProvider>`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/services/queryClient';
// ...inside the returned JSX, wrap the current root:
// <QueryClientProvider client={queryClient}>
//   {/* existing root element, e.g. <RootNavigator /> and status bar */}
// </QueryClientProvider>
```

- [ ] **Step 4: Verify it type-checks and tests still pass**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; existing suite green.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/queryClient.ts App.tsx
git commit -m "feat: add React Query client and provider"
```

---

## Task 2: itemQuery — types, search, and type-aware filters

**Files:**
- Create: `src/domain/itemQuery.ts`
- Test: `src/domain/itemQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/itemQuery.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- itemQuery`
Expected: FAIL — `Cannot find module './itemQuery'`.

- [ ] **Step 3: Write the implementation**

Create `src/domain/itemQuery.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- itemQuery`
Expected: PASS (all search + filter cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/itemQuery.ts src/domain/itemQuery.test.ts
git commit -m "feat: itemQuery search and type-aware filters"
```

---

## Task 3: itemQuery — generalized sort

**Files:**
- Modify: `src/domain/itemQuery.ts`
- Modify: `src/domain/itemQuery.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/domain/itemQuery.test.ts`:

```ts
import { SortSpec } from './itemQuery';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- itemQuery`
Expected: FAIL — `SortSpec` not exported / `sort` not handled.

- [ ] **Step 3: Implement sort**

In `src/domain/itemQuery.ts`, add the sort types and extend `ItemQuerySpec` + `applyQuery`:

```ts
export type SortField =
  | { kind: 'dateAdded' }
  | { kind: 'title' }
  | { kind: 'field'; key: string }; // a rating or number field
export interface SortSpec {
  field: SortField;
  direction: 'asc' | 'desc';
}
```

Add `sort?: SortSpec;` to `ItemQuerySpec`. Then, before the final `return result;` in `applyQuery`, insert:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- itemQuery`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/itemQuery.ts src/domain/itemQuery.test.ts
git commit -m "feat: itemQuery generalized sort"
```

---

## Task 4: itemQuery — computeStats

**Files:**
- Modify: `src/domain/itemQuery.ts`
- Modify: `src/domain/itemQuery.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/domain/itemQuery.test.ts`:

```ts
import { computeStats } from './itemQuery';
import { FieldDef } from './types';

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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- itemQuery`
Expected: FAIL — `computeStats` not exported.

- [ ] **Step 3: Implement computeStats**

Append to `src/domain/itemQuery.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- itemQuery`
Expected: PASS (full itemQuery suite green).

- [ ] **Step 5: Commit**

```bash
git add src/domain/itemQuery.ts src/domain/itemQuery.test.ts
git commit -m "feat: itemQuery computeStats"
```

---

## Task 5: React Query hooks for catalog data

**Files:**
- Create: `src/hooks/useCatalogQueries.ts`

No unit test (thin wrappers over the repo + React Query, verified via screens in later tasks).

- [ ] **Step 1: Create the hooks module**

Create `src/hooks/useCatalogQueries.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { CatalogItem, CatalogList } from '../domain/types';

export const catalogKeys = {
  lists: (uid: string) => ['lists', uid] as const,
  counts: (uid: string) => ['counts', uid] as const,
  items: (uid: string, listId: string) => ['items', uid, listId] as const,
};

export function useLists() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({
    queryKey: catalogKeys.lists(uid ?? 'anon'),
    enabled: !!uid,
    queryFn: () => new FirebaseCatalogRepository(uid!).getLists(),
  });
}

export function useItemCounts(listIds: string[]) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Record<string, number>>({
    queryKey: [...catalogKeys.counts(uid ?? 'anon'), listIds.slice().sort().join(',')],
    enabled: !!uid && listIds.length > 0,
    queryFn: () => new FirebaseCatalogRepository(uid!).getItemCounts(listIds),
  });
}

export function useItems(listId: string) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<CatalogItem[]>({
    queryKey: catalogKeys.items(uid ?? 'anon', listId),
    enabled: !!uid,
    queryFn: () => new FirebaseCatalogRepository(uid!).getItems(listId),
  });
}

// Call after any item write so cached items + Home counts refresh.
export function useInvalidateCatalog(listId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid ?? 'anon';
  return () => {
    qc.invalidateQueries({ queryKey: catalogKeys.items(uid, listId) });
    qc.invalidateQueries({ queryKey: catalogKeys.counts(uid) });
    qc.invalidateQueries({ queryKey: catalogKeys.lists(uid) });
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCatalogQueries.ts
git commit -m "feat: React Query hooks for catalog data"
```

---

## Task 6: FilterSortSheet component

**Files:**
- Create: `src/components/FilterSortSheet.tsx`

No unit test (presentational; state lives in `ListDetailScreen`, logic in `itemQuery`). Verified in Task 9.

- [ ] **Step 1: Create the component**

Create `src/components/FilterSortSheet.tsx`. It follows the animated-sheet pattern used by `CatalogActionsSheet.tsx` (Modal + reanimated slide-up, kept mounted through the close animation). It is a controlled component: parent owns `sort` and `filters` state and passes setters.

```tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { CatalogList } from '../domain/types';
import { Filters, SortField, SortSpec, DATE_FILTER_KEY } from '../domain/itemQuery';
import { theme } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  list: CatalogList;
  sort: SortSpec;
  onSortChange: (sort: SortSpec) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

// Sortable options: date, title, then each rating/number field in the schema.
function sortOptions(list: CatalogList): { label: string; field: SortField }[] {
  const opts: { label: string; field: SortField }[] = [
    { label: 'Date added', field: { kind: 'dateAdded' } },
    { label: 'Title', field: { kind: 'title' } },
  ];
  for (const f of list.fields) {
    if (f.type === 'rating' || f.type === 'number') {
      opts.push({ label: f.label, field: { kind: 'field', key: f.key } });
    }
  }
  return opts;
}

function sameField(a: SortField, b: SortField): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'field' && b.kind === 'field') return a.key === b.key;
  return true;
}

export function FilterSortSheet({
  visible,
  onClose,
  list,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(700);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (f) => {
        if (f) runOnJS(setRendered)(false);
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  if (!rendered) return null;

  function setFilter(key: string, filter: Filters[string] | undefined) {
    const next = { ...filters };
    if (filter === undefined) delete next[key];
    else next[key] = filter;
    onFiltersChange(next);
  }

  const boolFields = list.fields.filter((f) => f.type === 'boolean');
  const rangeFields = list.fields.filter((f) => f.type === 'rating' || f.type === 'number');

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      </Pressable>
      <Animated.View
        onLayout={(e) => (sheetHeight.value = e.nativeEvent.layout.height)}
        style={[styles.sheet, sheetStyle]}
        className="absolute inset-x-0 bottom-0 bg-surface-container rounded-t-3xl p-5"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">Sort by</Text>
          <View className="gap-2 mb-6">
            {sortOptions(list).map((opt) => {
              const active = sameField(sort.field, opt.field);
              return (
                <Pressable
                  key={opt.label}
                  onPress={() =>
                    onSortChange({
                      field: opt.field,
                      direction: active && sort.direction === 'desc' ? 'asc' : 'desc',
                    })
                  }
                  className={`flex-row items-center justify-between rounded-lg px-4 py-3 border ${
                    active ? 'border-primary' : 'border-outline-variant/40'
                  }`}
                >
                  <Text className="font-body-md text-body-md text-on-surface">{opt.label}</Text>
                  {active && (
                    <MaterialIcons
                      name={sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                      size={18}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {(rangeFields.length > 0 || boolFields.length > 0) && (
            <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">Filters</Text>
          )}

          {rangeFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' ? current.min : undefined;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}: at least {min ?? 'any'}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[undefined, ...thresholdsFor(f.type, f.ratingScale?.max)].map((t, idx) => {
                    const selected = min === t;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() =>
                          setFilter(f.key, t === undefined ? undefined : { kind: 'range', min: t })
                        }
                        className={`px-3 py-2 rounded-full border ${
                          selected ? 'border-primary bg-primary/10' : 'border-outline-variant/40'
                        }`}
                      >
                        <Text className="font-label-md text-label-md text-on-surface">
                          {t === undefined ? 'Any' : `${t}+`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {boolFields.map((f) => {
            const current = filters[f.key];
            const val = current?.kind === 'boolean' ? current.value : undefined;
            const options: { label: string; value: boolean | undefined }[] = [
              { label: 'Any', value: undefined },
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ];
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}
                </Text>
                <View className="flex-row gap-2">
                  {options.map((o) => {
                    const selected = val === o.value;
                    return (
                      <Pressable
                        key={o.label}
                        onPress={() =>
                          setFilter(f.key, o.value === undefined ? undefined : { kind: 'boolean', value: o.value })
                        }
                        className={`px-4 py-2 rounded-full border ${
                          selected ? 'border-primary bg-primary/10' : 'border-outline-variant/40'
                        }`}
                      >
                        <Text className="font-label-md text-label-md text-on-surface">{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Pressable onPress={() => onFiltersChange({})} className="mt-2 mb-1 py-3 items-center">
            <Text className="font-label-md text-label-md text-primary">Clear all filters</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// Threshold chips: ratings step by 2 up to their max (default 10); numbers use a
// small generic ladder. Kept simple deliberately — a range slider is future work.
function thresholdsFor(type: 'rating' | 'number', ratingMax = 10): number[] {
  if (type === 'rating') {
    const out: number[] = [];
    for (let t = 2; t <= ratingMax; t += 2) out.push(t);
    return out;
  }
  return [10, 25, 50, 100];
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterSortSheet.tsx
git commit -m "feat: FilterSortSheet with sort and type-aware filters"
```

---

## Task 7: CatalogStats component

**Files:**
- Create: `src/components/CatalogStats.tsx`

No unit test (presentational over `CatalogStatsData`; math is tested in Task 4).

- [ ] **Step 1: Create the component**

Create `src/components/CatalogStats.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CatalogStatsData } from '../domain/itemQuery';
import { theme } from '../theme/theme';

interface Props {
  stats: CatalogStatsData;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function CatalogStats({ stats }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mx-5 mb-3 rounded-xl bg-surface-container-low overflow-hidden">
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center justify-between px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel="Toggle catalog stats"
      >
        <Text className="font-label-md text-label-md text-on-surface">
          {stats.total} {stats.total === 1 ? 'item' : 'items'}
        </Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded && stats.fields.length > 0 && (
        <View className="px-4 pb-3 gap-2">
          {stats.fields.map((f) => (
            <View key={f.key} className="flex-row justify-between">
              <Text className="font-body-md text-body-md text-on-surface-variant">{f.label}</Text>
              <Text className="font-body-md text-body-md text-on-surface">
                {f.type === 'rating' && `avg ${fmt(f.average)}`}
                {f.type === 'number' && `avg ${fmt(f.average)} · ${fmt(f.min)}–${fmt(f.max)}`}
                {f.type === 'boolean' && `${f.yes} yes · ${f.no} no`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CatalogStats.tsx
git commit -m "feat: collapsible CatalogStats strip"
```

---

## Task 8: ItemDetailScreen + route + tap change

**Files:**
- Create: `src/screens/ItemDetailScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add the route type and screen registration**

In `src/navigation/RootNavigator.tsx`:
- Add to `RootStackParamList`: `ItemDetail: { list: CatalogList; item: CatalogItem };`
- Import `ItemDetailScreen` and register inside the authed stack (alongside `ItemForm`):

```tsx
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
// ...
<Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
```

- [ ] **Step 2: Create the screen**

Create `src/screens/ItemDetailScreen.tsx`:

```tsx
import { useLayoutEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef } from '../domain/types';
import { StarRating } from '../components/StarRating';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { useInvalidateCatalog } from '../hooks/useCatalogQueries';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ItemDetailScreen({ route, navigation }: Props) {
  const { list, item } = route.params;
  const { user } = useAuth();
  const invalidate = useInvalidateCatalog(list.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: item.title || 'Item',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ItemForm', { list, item })}
          accessibilityLabel="Edit item"
          accessibilityRole="button"
        >
          <MaterialIcons name="edit" size={22} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, list, item]);

  function remove() {
    if (!user) return;
    Alert.alert('Delete item?', `This removes "${item.title}" permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await new FirebaseCatalogRepository(user.uid).deleteItem(list.id, item.id);
            invalidate();
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete item', error);
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  }

  // Show only fields that have a value; render each by its type.
  const visibleFields = list.fields.filter(
    (f: FieldDef) => f.type !== 'photo' && !isEmpty(item.values[f.key])
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-16">
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} className="w-full h-72" resizeMode="cover" />
      ) : (
        <View className="w-full h-72 bg-surface-container items-center justify-center">
          <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            No photo
          </Text>
        </View>
      )}

      <View className="p-5 gap-4">
        <Text className="font-headline-md text-headline-md text-on-surface">{item.title}</Text>

        {visibleFields.map((field) => {
          const value = item.values[field.key];
          return (
            <View key={field.key} className="gap-1">
              <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {field.label}
              </Text>
              {field.type === 'rating' ? (
                <StarRating rating={Number(value)} max={field.ratingScale?.max ?? 10} size={18} />
              ) : field.type === 'boolean' ? (
                <View
                  className={`self-start px-3 py-1 rounded-full ${
                    value ? 'bg-primary/15' : 'bg-surface-container'
                  }`}
                >
                  <Text className="font-label-md text-label-md text-on-surface">
                    {value ? 'Yes' : 'No'}
                  </Text>
                </View>
              ) : field.type === 'date' ? (
                <Text className="font-body-md text-body-md text-on-surface">
                  {formatDate(Number(value))}
                </Text>
              ) : (
                <Text className="font-body-md text-body-md text-on-surface">{String(value)}</Text>
              )}
            </View>
          );
        })}

        <Pressable onPress={remove} className="mt-4 py-3">
          <Text className="font-label-md text-label-md text-error text-center">Delete item</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Point item taps at the detail screen**

In `src/screens/ListDetailScreen.tsx`, change the `ItemCard` `onPress` in the `FlatList` `renderItem` from:

```tsx
onPress={() => navigation.navigate('ItemForm', { list, item })}
```

to:

```tsx
onPress={() => navigation.navigate('ItemDetail', { list, item })}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ItemDetailScreen.tsx src/navigation/RootNavigator.tsx src/screens/ListDetailScreen.tsx
git commit -m "feat: read-only ItemDetail screen; item tap opens it"
```

---

## Task 9: Wire ListDetailScreen — React Query, Filter&sort button, sheet, stats

**Files:**
- Modify: `src/screens/ListDetailScreen.tsx`

- [ ] **Step 1: Replace data loading and the control row**

Rewrite `ListDetailScreen` so it:
- reads items via `useItems(list.id)` (drop `useState<items>`, `useCallback load`, `useFocusEffect`, and the old rating-sort `SortMode` machinery),
- holds `search`, `sort` (default `{ field: { kind: 'dateAdded' }, direction: 'desc' }`), `filters` ({}), and `sheetVisible` state,
- computes `visible = applyQuery(items, { searchText: debouncedSearch, filters, sort })` and `stats = computeStats(visible, list.fields)` with `useMemo`,
- renders `CatalogStats` above the list and a single "Filter & sort" button (with an active-filter count badge) beside the search box, opening `FilterSortSheet`.

Full file:

```tsx
import { useLayoutEffect, useMemo, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { CatalogActionsSheet } from '../components/CatalogActionsSheet';
import { FilterSortSheet } from '../components/FilterSortSheet';
import { CatalogStats } from '../components/CatalogStats';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useItems, useInvalidateCatalog } from '../hooks/useCatalogQueries';
import { applyQuery, computeStats, Filters, SortSpec } from '../domain/itemQuery';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

const DEFAULT_SORT: SortSpec = { field: { kind: 'dateAdded' }, direction: 'desc' };

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const { data: items = [] } = useItems(list.id);
  const invalidate = useInvalidateCatalog(list.id);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const [filters, setFilters] = useState<Filters>({});
  const [sheetVisible, setSheetVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);

  const visible = useMemo(
    () => applyQuery(items, { searchText: debouncedSearch, filters, sort }),
    [items, debouncedSearch, filters, sort]
  );
  const stats = useMemo(() => computeStats(visible, list.fields), [visible, list.fields]);
  const filterCount = Object.keys(filters).length;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setActionsVisible(true)}
          accessibilityLabel="Catalog actions"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  function confirmDeleteList() {
    if (!user) return;
    Alert.alert('Delete list?', `This removes "${list.name}" and all its items permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await new FirebaseCatalogRepository(user.uid).deleteList(list.id);
            invalidate();
            navigation.navigate('Home');
          } catch (error) {
            Alert.alert('Could not delete list', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <Text
        className="px-5 pt-4 font-headline-md text-headline-md text-on-surface"
        numberOfLines={1}
      >
        {list.name}
      </Text>
      <View className="px-5 pt-3 pb-4 flex-row items-stretch gap-3">
        <TextInput
          className="flex-1 bg-surface-container-low rounded-lg p-4 font-body-md text-body-md text-on-surface"
          placeholder="Search"
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={setSearch}
        />
        <Pressable
          onPress={() => setSheetVisible(true)}
          className={`flex-row items-center justify-center gap-1 px-4 rounded-lg border ${
            filterCount > 0 ? 'border-primary' : 'border-outline-variant/40'
          }`}
          accessibilityLabel="Filter and sort"
          accessibilityRole="button"
        >
          <MaterialIcons
            name="tune"
            size={18}
            color={filterCount > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
          {filterCount > 0 && (
            <Text className="font-label-sm text-label-sm text-primary">{filterCount}</Text>
          )}
        </Pressable>
      </View>

      <CatalogStats stats={stats} />

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerClassName="px-5 pb-24"
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemDetail', { list, item })}
          />
        )}
        ListEmptyComponent={
          <View className="items-center pt-24 px-8 gap-3">
            <View className="w-16 h-16 rounded-full bg-surface-container items-center justify-center">
              <MaterialIcons
                name={debouncedSearch.trim() || filterCount > 0 ? 'search-off' : 'inbox'}
                size={30}
                color={theme.colors.outline}
              />
            </View>
            <Text className="font-headline-sm text-headline-sm text-on-surface text-center">
              {debouncedSearch.trim() || filterCount > 0 ? 'No matches' : 'This catalog is empty'}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant text-center">
              {debouncedSearch.trim() || filterCount > 0
                ? 'Try adjusting your search or filters.'
                : 'Tap + to add your first item.'}
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => navigation.navigate('ItemForm', { list })}
        className="absolute right-5 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        accessibilityLabel="Add item"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>

      <FilterSortSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        list={list}
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <CatalogActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        onEdit={() => {
          setActionsVisible(false);
          navigation.navigate('EditListFields', { list });
        }}
        onDelete={() => {
          setActionsVisible(false);
          confirmDeleteList();
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; suite green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ListDetailScreen.tsx
git commit -m "feat: ListDetail filter/sort sheet, stats, React Query items"
```

---

## Task 10: Migrate HomeScreen and ItemForm to the cache

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/ItemFormScreen.tsx`

- [ ] **Step 1: HomeScreen reads via React Query**

In `src/screens/HomeScreen.tsx`, replace the `useState` + `useFocusEffect` fetch with hooks:
- Remove `lists`/`counts`/`loading` `useState`, the `useFocusEffect` block, and the direct `FirebaseCatalogRepository` import.
- Add:

```tsx
import { useLists, useItemCounts } from '../hooks/useCatalogQueries';
// inside component:
const { data: lists = [], isLoading } = useLists();
const { data: counts = {} } = useItemCounts(lists.map((l) => l.id));
```

- Replace references to the old `loading` with `isLoading`, and keep the existing `filteredLists`/`gridCells` `useMemo`s (they already derive from `lists`). The loading spinner block stays, gated on `isLoading`.

- [ ] **Step 2: ItemForm invalidates the cache after writes**

In `src/screens/ItemFormScreen.tsx`:
- Add `import { useInvalidateCatalog } from '../hooks/useCatalogQueries';` and, inside the component, `const invalidate = useInvalidateCatalog(list.id);`.
- In `save()`, after the successful `await repo.updateItem(...)` / `await repo.addItem(...)` and before `navigation.goBack()`, call `invalidate();`.
- In `remove()`, after `await repo.deleteItem(...)` and before `navigation.goBack()`, call `invalidate();`.

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; suite green.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/ItemFormScreen.tsx
git commit -m "feat: Home reads via React Query; ItemForm invalidates cache"
```

---

## Task 11: Full verification and manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all Jest `app` tests green (including the full `itemQuery` suite).

- [ ] **Step 2: Manual smoke on device/emulator**

Run: `npm run android` (or `npm run ios`). Verify, in a catalog that has a rating field, a number field, and a boolean field:
- Tapping an item opens the **read-only detail** screen; empty fields are absent; **Edit** opens the form; **Delete** removes the item and returns to the list with it gone.
- The **Filter & sort** button opens the sheet. Changing sort reorders the list. Setting a rating threshold + a boolean filter narrows the list (AND); the button shows the active count; **Clear all filters** resets it.
- The **stats strip** shows the count and, expanded, per-field summaries, and its numbers **change with the active filters**.
- Editing an item, then returning to the list, shows the change **without a manual refresh** (cache invalidation works).
- Home still lists catalogs with correct counts.

- [ ] **Step 3: Commit any fixes discovered**

```bash
git add -A
git commit -m "fix: address catalog-browsing smoke-test findings"
```

---

## Self-Review Notes

- **Spec coverage:** detail screen (Task 8), type-aware filters + generalized sort in one sheet (Tasks 2–3, 6, 9), filter-aware collapsible stats (Tasks 4, 7, 9), client-side `itemQuery` (Tasks 2–4), app-wide React Query with mutation invalidation (Tasks 1, 5, 9, 10). Deferred items (localization, sharing, export, barcode) intentionally absent.
- **Repo query path:** left untouched to keep `FirebaseCatalogRepository.test.ts` (emulator) green; the app just stops passing a query. Matches the spec's reconciliation note.
- **Type consistency:** `Filters`, `Filter`, `SortSpec`, `SortField`, `ItemQuerySpec`, `CatalogStatsData`, `FieldStat`, `catalogKeys`, `useItems`, `useInvalidateCatalog` names are used identically across tasks.
