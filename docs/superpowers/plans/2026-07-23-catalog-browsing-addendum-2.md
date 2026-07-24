# Catalog Browsing — Addendum Plan 2 (on-device feedback)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Three on-device refinements to the Filter & sort experience: (1) sort rows always show a direction arrow; (2) the rating filter is a slider instead of threshold chips; (3) each catalog can mark which rating/number fields are sortable.

**Context:** Follows `2026-07-23-catalog-browsing-addendum.md` on branch `feat/catalog-browsing`. User decisions: slider is **min-only, single-thumb**, **rating fields only** (number keeps chips); sort config is a **per-field `sortable` flag** governing custom rating/number fields only (Date added + Title always available), **undefined = sortable** (backward compatible, no migration).

**Tech stack additions:** `@react-native-community/slider` (via `npx expo install`; native module → dev build).

**Order:** Task E first (adds `FieldDef.sortable`), then Task D (FilterSortSheet reads it).

---

## Task E: `FieldDef.sortable` + "Allow sorting" toggle in the field editor

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/screens/EditListFieldsScreen.tsx`

- [ ] **Step 1: Add the field to the type**

In `src/domain/types.ts`, add `sortable` to `FieldDef`:

```ts
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  ratingScale?: RatingScale;
  // For rating/number fields: whether this field is offered as a sort option.
  // undefined = sortable (default, backward-compatible with existing catalogs).
  sortable?: boolean;
}
```

- [ ] **Step 2: Import `Switch` in the editor**

In `src/screens/EditListFieldsScreen.tsx`, add `Switch` to the existing `react-native` import (it already imports `View`, `Text`, `TextInput`, `Pressable`, etc.). `theme` is already imported.

- [ ] **Step 3: Render the toggle for rating/number fields**

In the `renderItem` field card (currently ending with the type picker block and the `{!locked && (<Remove field>)}` Pressable around lines 217-221), insert this block **immediately before** the `{!locked && (` remove-field block:

```tsx
              {(item.type === 'rating' || item.type === 'number') && (
                <View className="flex-row items-center justify-between">
                  <Text className="font-label-md text-label-md text-on-surface-variant">
                    Allow sorting by this field
                  </Text>
                  <Switch
                    value={item.sortable !== false}
                    onValueChange={(v) => updateField(index, { sortable: v })}
                    trackColor={{ true: theme.colors.primary }}
                  />
                </View>
              )}
```

Notes:
- `item.sortable !== false` makes the toggle default ON (undefined → on), matching the backward-compatible default.
- This shows for the locked rating field too (type `'rating'`), which is fine — a catalog may choose not to sort by its base rating.
- The `sortable` value persists automatically: `save()` passes the whole `fields` array to `updateListFields`/`createList`, which already round-trips arbitrary `FieldDef` properties.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm test`
Expected: 0 tsc errors; 7 suites / 54 tests green (no logic change to tested code).

```bash
git add src/domain/types.ts src/screens/EditListFieldsScreen.tsx
git commit -m "feat: per-field sortable flag with editor toggle"
```

---

## Task D: FilterSortSheet — persistent sort arrows, rating slider, sortable-aware sort list

**Files:**
- Install: `@react-native-community/slider`
- Modify: `src/components/FilterSortSheet.tsx`

- [ ] **Step 1: Install the slider**

Run: `npx expo install @react-native-community/slider`
Expected: adds the SDK-57-compatible version to `dependencies`. (Native module — dev build, not Expo Go. No JS test; verified in the manual smoke.)

- [ ] **Step 2: Import the slider**

In `src/components/FilterSortSheet.tsx`, add: `import Slider from '@react-native-community/slider';`

- [ ] **Step 3: Only offer sortable rating/number fields as sort options**

In the `sortOptions(list)` helper, the loop currently pushes every rating/number field. Add the `sortable` guard so only fields not explicitly disabled appear:

```ts
  for (const f of list.fields) {
    if ((f.type === 'rating' || f.type === 'number') && f.sortable !== false) {
      opts.push({ label: f.label, field: { kind: 'field', key: f.key } });
    }
  }
```

(Date added and Title are pushed unconditionally before the loop — leave them.)

- [ ] **Step 4: Always show a direction arrow on each sort row**

Replace the conditional arrow (currently `{active && (<MaterialIcons name={sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={18} color={theme.colors.primary} />)}`) with an always-rendered arrow — the active row shows the live direction in the accent color; inactive rows show the direction a tap will apply (desc → down) in a muted color:

```tsx
                  <MaterialIcons
                    name={
                      active && sort.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'
                    }
                    size={18}
                    color={active ? theme.colors.primary : theme.colors.onSurfaceVariant}
                  />
```

- [ ] **Step 5: Split range fields; rating → slider, number → chips**

Replace the single `rangeFields` definition (`const rangeFields = list.fields.filter((f) => f.type === 'rating' || f.type === 'number');`) with two:

```ts
  const ratingFields = list.fields.filter((f) => f.type === 'rating');
  const numberFields = list.fields.filter((f) => f.type === 'number');
```

Update the Filters-heading condition to reference them:

```tsx
          {(ratingFields.length > 0 ||
            numberFields.length > 0 ||
            boolFields.length > 0 ||
            dateFields.length > 0) && (
            <Text className="font-headline-sm text-headline-sm text-on-surface mb-3">Filters</Text>
          )}
```

Replace the entire `{rangeFields.map((f) => { ... })}` block with a rating-slider block followed by a number-chips block:

```tsx
          {ratingFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' && current.min !== undefined ? current.min : 0;
            const max = f.ratingScale?.max ?? 10;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}: {min === 0 ? 'any' : `at least ${min}`}
                </Text>
                <Slider
                  minimumValue={0}
                  maximumValue={max}
                  step={1}
                  value={min}
                  onSlidingComplete={(v) =>
                    setFilter(f.key, v === 0 ? undefined : { kind: 'range', min: v })
                  }
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.outlineVariant}
                  thumbTintColor={theme.colors.primary}
                />
              </View>
            );
          })}

          {numberFields.map((f) => {
            const current = filters[f.key];
            const min = current?.kind === 'range' ? current.min : undefined;
            return (
              <View key={f.key} className="mb-4">
                <Text className="font-label-md text-label-md text-on-surface-variant mb-2">
                  {f.label}: at least {min ?? 'any'}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[undefined, ...NUMBER_THRESHOLDS].map((t, idx) => {
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
```

Notes:
- The rating slider commits the filter on `onSlidingComplete` (not `onValueChange`) so the item list/stats don't recompute on every pixel of the drag; `value={min}` keeps the thumb in sync with the committed filter. `0` clears the filter.
- `theme.colors.outlineVariant` / `theme.colors.onSurfaceVariant` / `theme.colors.primary` — confirm these keys exist on `theme.colors` (they are used elsewhere in this file/components); if `outlineVariant` is not a key, omit `maximumTrackTintColor`.

- [ ] **Step 6: Replace `thresholdsFor` with a number-only constant**

The `thresholdsFor(type, ratingMax)` helper's rating branch is now unused (rating uses the slider). Replace the helper with a plain constant used by the number block above:

```ts
// Number filter offers a small fixed ladder of "at least" thresholds.
const NUMBER_THRESHOLDS = [10, 25, 50, 100];
```

Delete the old `thresholdsFor` function and its comment.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npm test`
Expected: 0 tsc errors; 7 suites / 54 tests green.

```bash
git add package.json package-lock.json src/components/FilterSortSheet.tsx
git commit -m "feat: persistent sort arrows, rating slider, sortable-aware sort list"
```

---

## Manual smoke additions (human, dev build)
- Every sort row shows a direction arrow; the active one is accent-colored and flips up/down as you toggle it; inactive rows show a muted down arrow.
- A rating field's filter is a slider ("at least X"); dragging narrows the list on release; sliding to 0 clears it. Number fields still show the +chips.
- In the field editor, toggling "Allow sorting" off for a rating/number field removes it from the sort list (after re-opening the catalog); existing catalogs still list all their numeric fields.

## Self-review
- Covers all three requests. `FieldDef.sortable` is additive/optional (no migration). Only `FilterSortSheet` and the editor/type change are touched; `itemQuery` and its tests are unchanged (no logic change), so the suite stays at 54.
- Type consistency: `sortable?: boolean` (undefined = on); slider commits `{ kind: 'range', min }` — the same filter shape the number chips and itemQuery already use; `NUMBER_THRESHOLDS` replaces `thresholdsFor`.
