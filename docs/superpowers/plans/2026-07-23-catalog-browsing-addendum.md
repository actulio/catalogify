# Catalog Browsing — Addendum Plan (final-review fixes + date fields)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Resolve the final whole-branch review findings and firm up the `date` field type so date-range filtering is sound.

**Context:** Follows the executed plan `2026-07-23-catalog-browsing.md`. The final review (opus) returned "merge with fixes": two spec deviations (missing date-filter UI; Clear-all not resetting sort) + cleanups (dead code, provider dup, trim unused rating distribution, edge tests). User decisions: **build date filtering fully** (the `date` field is currently free-text with no picker — must be firmed up) and **trim the distribution**.

**Canonical decision — date storage:** a `date` field value is stored as **milliseconds since epoch (a `number`)**. This matches `ItemDetailScreen`'s existing `formatDate(Number(value))` and the itemQuery date logic. Empty = `null`/`undefined`.

**Tech stack additions:** `@react-native-community/datetimepicker` (installed via `npx expo install`, Expo SDK 57; native module → requires the existing dev build, not Expo Go).

---

## Task A: itemQuery — date filter on field values, trim distribution, stats consistency, edge tests

**Files:**
- Modify: `src/domain/itemQuery.ts`
- Modify: `src/domain/itemQuery.test.ts`

- [ ] **Step 1: Update tests (TDD)**

In `src/domain/itemQuery.test.ts`:

1. Add a `date` field value to the fixture items. Change the three `item({...})` fixtures to include a `opened` date value (ms epoch), e.g. `values: { rating: 9, price: 40, decaf: false, opened: 1000 }` for `a`, `opened: 2000` for `b`, `opened: 3000` for `c`.

2. Replace the existing dateRange test (the one using `__date` / `createdAt`) with a field-keyed version:

```ts
  it('dateRange filters a date field value inclusive', () => {
    const filters: Filters = { opened: { kind: 'dateRange', from: 1500, to: 2500 } };
    expect(applyQuery(items, { filters }).map((i) => i.id)).toEqual(['b']);
  });

  it('dateRange excludes items missing the date value', () => {
    const noDate = item({ id: 'd', title: 'No date', values: { rating: 5 } });
    const filters: Filters = { opened: { kind: 'dateRange', from: 0, to: 9999 } };
    expect(applyQuery([...items, noDate], { filters }).map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
  });
```

3. Add the edge-case tests the review asked for:

```ts
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
```

4. In the `computeStats` describe block: remove any assertion on `distribution`. Add a stats consistency test:

```ts
  it('boolean stats ignore items missing the field', () => {
    const noDecaf = item({ id: 'd', title: 'No decaf', values: { rating: 5 } });
    const decaf = computeStats([...items, noDecaf], fields).fields.find((f) => f.key === 'decaf');
    // 3 items have decaf set (1 true, 2 false); the 4th (missing) is ignored
    expect(decaf).toMatchObject({ type: 'boolean', yes: 1, no: 2 });
  });
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npm test -- itemQuery`
Expected: the new/updated tests FAIL (dateRange still reads createdAt; boolean stats count missing as no; range/boolean don't yet exclude missing — verify each expected failure).

- [ ] **Step 3: Implement in `src/domain/itemQuery.ts`**

3a. **Repoint the date filter to a field value.** In `matchesFilter`, change the `dateRange` branch so it reads the field value by key (ms epoch) instead of `item.createdAt`:

```ts
  if (filter.kind === 'dateRange') {
    const t = Number(item.values[key] ?? NaN);
    if (Number.isNaN(t)) return false;
    if (filter.from !== undefined && t < filter.from) return false;
    if (filter.to !== undefined && t > filter.to) return false;
    return true;
  }
```

3b. **Remove the reserved-key constant.** Delete `export const DATE_FILTER_KEY = '__date';` and its explanatory comment. Update the `Filters` type comment to: `// Keyed by field.key. A dateRange filter is keyed by a date field's key and matches that field's ms-epoch value.`

3c. **Boolean stats ignore missing values.** In `computeStats`, change the boolean branch so only items whose value is a real boolean are counted:

```ts
    } else if (field.type === 'boolean') {
      let yes = 0;
      let no = 0;
      for (const i of items) {
        const v = i.values[field.key];
        if (v === true) yes += 1;
        else if (v === false) no += 1;
        // missing/other → ignored, mirroring numeric stats
      }
      stats.push({ key: field.key, label: field.label, type: 'boolean', yes, no });
    }
```

3d. **Trim the distribution.** Remove `distribution: Record<number, number>;` from the `RatingStat` interface, and remove the distribution-building block from the rating branch so it pushes:

```ts
        stats.push({ key: field.key, label: field.label, type: 'rating', count, average });
```

3e. **Export the default sort** (needed by Task C's Clear-all). Add near the sort types:

```ts
export const DEFAULT_SORT: SortSpec = { field: { kind: 'dateAdded' }, direction: 'desc' };
```

- [ ] **Step 4: Run tests — expect green**

Run: `npm test -- itemQuery && npx tsc --noEmit`
Expected: all itemQuery tests pass; tsc reports 0 errors. (tsc will FAIL to compile `FilterSortSheet.tsx` until Task C removes its `DATE_FILTER_KEY` import — if so, note it; it is expected and Task C resolves it. If you can, run `npx tsc --noEmit` and confirm the ONLY new error is the `DATE_FILTER_KEY` import in FilterSortSheet.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/itemQuery.ts src/domain/itemQuery.test.ts
git commit -m "refactor: date filter on field values, trim rating distribution, stats consistency"
```

---

## Task B: Cleanups — App.tsx provider dedup, HomeScreen dead code

**Files:**
- Modify: `App.tsx`
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Dedupe the QueryClientProvider in `App.tsx`**

Read `App.tsx`. It currently wraps `<RootNavigator />` in `<QueryClientProvider>` in two separate return branches (font-error and normal). Restructure so the provider wraps once: compute the inner tree in a single variable / single return, or hoist the provider to wrap the whole conditional. The behavior must be unchanged (font-error path still degrades to system fonts and still renders; the `if (!loaded) return null;` early-return stays as-is and needs no provider). Keep the single module-level `queryClient` import.

- [ ] **Step 2: Remove HomeScreen dead code**

In `src/screens/HomeScreen.tsx`, delete the now-unused `const { user } = useAuth();` line and remove the `useAuth` import (confirm no other reference to `user`/`useAuth` remains in the file — the React Query hooks handle auth internally).

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` (expect: only the pre-existing Task-C-pending `DATE_FILTER_KEY` error, if Task A already landed; no NEW errors from this task) and `npm test` (expect: 7 suites green).

```bash
git add App.tsx src/screens/HomeScreen.tsx
git commit -m "chore: dedupe QueryClientProvider, drop HomeScreen dead useAuth"
```

---

## Task C: Date fields — picker entry, detail rendering, and the date-range filter

**Files:**
- Install: `@react-native-community/datetimepicker`
- Modify: `src/screens/ItemFormScreen.tsx`
- Modify: `src/screens/ItemDetailScreen.tsx`
- Modify: `src/components/FilterSortSheet.tsx`

- [ ] **Step 1: Install the picker**

Run: `npx expo install @react-native-community/datetimepicker`
Expected: adds the SDK-57-compatible version to `dependencies`. (Native module — takes effect in the dev build, not Expo Go. No JS test covers the picker; it is verified in the manual smoke.)

- [ ] **Step 2: ItemForm — date entry via the picker (store ms epoch)**

In `src/screens/ItemFormScreen.tsx`:
- Import: `import DateTimePicker from '@react-native-community/datetimepicker';` and add `useState` for the open picker: `const [datePickerFor, setDatePickerFor] = useState<string | null>(null);`
- Remove `'date'` from the shared `shortText | number | date` TextInput branch condition (line ~122) so it becomes `field.type === 'shortText' || field.type === 'number'`.
- Add a dedicated `date` branch after it:

```tsx
            {field.type === 'date' && (
              <>
                <Pressable
                  onPress={() => setDatePickerFor(field.key)}
                  className="bg-surface-container-low border border-surface-dim rounded-lg p-4"
                >
                  <Text className="font-body-md text-body-md text-on-surface">
                    {values[field.key] != null
                      ? new Date(Number(values[field.key])).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Tap to pick a date'}
                  </Text>
                </Pressable>
                {datePickerFor === field.key && (
                  <DateTimePicker
                    value={values[field.key] != null ? new Date(Number(values[field.key])) : new Date()}
                    mode="date"
                    onChange={(event, selected) => {
                      setDatePickerFor(null);
                      if (event.type === 'set' && selected) setValue(field.key, selected.getTime());
                    }}
                  />
                )}
              </>
            )}
```

Note: on Android the picker shows as a dismissable dialog (auto-closes on select/cancel — the `setDatePickerFor(null)` in onChange handles both). On iOS it renders inline; acceptable for now.

- [ ] **Step 3: ItemDetail — guard invalid dates**

In `src/screens/ItemDetailScreen.tsx`, make `formatDate` robust to legacy non-numeric values so it never prints "Invalid Date":

```tsx
function formatDate(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
```

(The call site already passes `Number(value)`, which yields `NaN` for legacy free-text values → now renders `—` instead of "Invalid Date".)

- [ ] **Step 4: FilterSortSheet — date-range control + Clear-all resets sort**

In `src/components/FilterSortSheet.tsx`:
- Remove the now-deleted `DATE_FILTER_KEY` from the itemQuery import; add `DEFAULT_SORT` to it. Import the picker and add local state: `const [datePickerFor, setDatePickerFor] = useState<{ key: string; bound: 'from' | 'to' } | null>(null);` and `import DateTimePicker from '@react-native-community/datetimepicker';`
- Compute `const dateFields = list.fields.filter((f) => f.type === 'date');`
- After the `boolFields.map(...)` block, render a date-range control per date field:

```tsx
          {dateFields.map((f) => {
            const current = filters[f.key];
            const range = current?.kind === 'dateRange' ? current : undefined;
            const label = (ms?: number) =>
              ms === undefined ? 'Any' : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
            function setBound(bound: 'from' | 'to', ms: number | undefined) {
              const next = { ...(range ?? { kind: 'dateRange' as const }) };
              if (ms === undefined) delete next[bound];
              else next[bound] = ms;
              // if both bounds cleared, drop the filter entirely
              if (next.from === undefined && next.to === undefined) setFilter(f.key, undefined);
              else setFilter(f.key, next);
            }
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">{f.label}</Text>
                <View className="flex-row gap-2">
                  {(['from', 'to'] as const).map((bound) => (
                    <Pressable
                      key={bound}
                      onPress={() => setDatePickerFor({ key: f.key, bound })}
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        range?.[bound] !== undefined ? 'border-primary' : 'border-outline-variant/40'
                      }`}
                    >
                      <Text className="font-label-sm text-label-sm text-on-surface-variant">
                        {bound === 'from' ? 'From' : 'To'}
                      </Text>
                      <Text className="font-body-md text-body-md text-on-surface">{label(range?.[bound])}</Text>
                    </Pressable>
                  ))}
                  {range && (
                    <Pressable onPress={() => setFilter(f.key, undefined)} className="px-3 py-2 justify-center">
                      <Text className="font-label-md text-label-md text-primary">Clear</Text>
                    </Pressable>
                  )}
                </View>
                {datePickerFor?.key === f.key && (
                  <DateTimePicker
                    value={range?.[datePickerFor.bound] !== undefined ? new Date(range[datePickerFor.bound]!) : new Date()}
                    mode="date"
                    onChange={(event, selected) => {
                      const bound = datePickerFor.bound;
                      setDatePickerFor(null);
                      if (event.type === 'set' && selected) setBound(bound, selected.getTime());
                    }}
                  />
                )}
              </View>
            );
          })}
```

- Show the Filters heading when any of `rangeFields`, `boolFields`, or `dateFields` is non-empty (update the existing conditional to include `dateFields.length > 0`).
- Change the "Clear all filters" Pressable to reset BOTH filters and sort, and relabel it "Clear all":

```tsx
          <Pressable
            onPress={() => {
              onFiltersChange({});
              onSortChange(DEFAULT_SORT);
            }}
            className="mt-2 mb-1 py-3 items-center"
          >
            <Text className="font-label-md text-label-md text-primary">Clear all</Text>
          </Pressable>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: 0 tsc errors (the `DATE_FILTER_KEY` import error from Task A is now resolved); 7 suites / test count green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/screens/ItemFormScreen.tsx src/screens/ItemDetailScreen.tsx src/components/FilterSortSheet.tsx
git commit -m "feat: date fields — picker entry, detail rendering, and date-range filter"
```

---

## Manual smoke additions (human, on the dev build)
- Add/edit an item with a `date` field → the picker sets a date; it displays formatted on the item detail.
- In Filter & sort, a `date` field shows From/To; picking a range narrows the list; Clear all resets filters AND returns sort to Date added (newest first).

## Self-review
- Covers all final-review findings: #1 date filter (Task A repoint + Task C UI + firmed-up field), #2 Clear-all resets sort (Task C), #3 boolean-stats consistency (Task A), #4 distribution trimmed (Task A), #5 App.tsx dedup (Task B), #6 HomeScreen dead code (Task B), #7 edge tests (Task A).
- Type names consistent: `DateRangeFilter{from,to}` (ms epoch) now keyed by field.key; `DEFAULT_SORT` exported from itemQuery and consumed by FilterSortSheet; `RatingStat` no longer has `distribution`.
