# Catalog browsing: detail screen, stats, filter & sort

**Date:** 2026-07-23
**Status:** Approved (brainstorming)
**Scope:** One release covering three browsing features on top of an app-wide data-layer move to React Query.

## Goal

Make a catalog something you can *browse and understand*, not just add to. Today the only ways to explore a catalog are a text search box and a rating-sort toggle, and tapping an item drops you straight into its edit form. This release adds a read-only item detail screen, filter-by-any-field with generalized sort, and per-catalog stats — all reading from a single cached, in-memory query pipeline.

## Features

### 1. Read-only item detail screen
- New full-screen route `ItemDetail`.
- Tapping an item card opens `ItemDetail` (previously opened `ItemForm` directly).
- Layout: hero photo at top (or the same "No photo" placeholder used on `ItemCard`), the item title, then every field rendered by its type:
  - rating → stars (`StarRating`), boolean → Yes/No chip, date → formatted, number / short / long text → as text.
- **Empty optional fields are hidden** — the view shows only what was actually recorded.
- Actions: **Edit** (primary → navigates to `ItemForm`) and **Delete** (with the existing confirm dialog). The detail screen becomes the single place to manage one item, mirroring how `ListDetail` is the single place to manage a catalog.

### 2. Filter & sort (consolidated)
- The `ListDetail` control row becomes: **search box + a single "Filter & sort" button**. The inline rating-sort toggle is removed.
- The button shows a badge with the active-filter count and opens `FilterSortSheet` (a bottom sheet reusing the animation pattern from `CatalogActionsSheet`).
- **Sort by** section — pick any sortable field, each with a direction:
  - Date added, Title (A–Z), and any `rating` or `number` field in the catalog schema.
- **Filters** — type-aware, one control per filterable field, **AND-combined**:
  - rating / number → min–max range ("at least X")
  - boolean → Yes / No / Any
  - date → date range
  - text fields (`shortText` / `longText`) → **no filter control** (the search box already covers text)
- **Clear all** resets filters only and returns sort to the default (Date added, newest first); it does not touch the search box.
- Search + filters + sort all feed the same client-side pipeline.

### 3. Per-catalog stats
- New `CatalogStats` component: a **collapsible strip above the item list**, collapsed by default, one tap to expand.
- Derived automatically from the catalog's field schema — no configuration:
  - total item count
  - per `rating` field → average + distribution
  - per `number` field → average / min / max
  - per `boolean` field → count yes / no
- **Filter-aware:** stats are computed over the *currently filtered* set, so they double as live feedback for the active filters (e.g. "12 items · avg 8.6").

## Architecture

### Decision 1 — Client-side "fetch-then-derive" (not server-side queries)

The repository returns **all items for a catalog**; a pure module derives filtered/sorted views and stats in memory.

- **`domain/itemQuery.ts`** (new, pure, no I/O):
  - `applyQuery(items, { searchText, filters, sort }) → CatalogItem[]`
  - `computeStats(items, fields) → CatalogStats`
- The server-side `searchText` / `sortByRatingKey` behavior in `FirebaseCatalogRepository.getItems` is **retired**; the repo exposes a plain "get all items for list" read.

**Why:** arbitrary-field filtering, arbitrary sort, and filter-aware stats are painful and brittle server-side in Firestore (composite indexes per field, no easy multi-field AND) and buy nothing at personal-catalog scale. A pure in-memory module is trivially fast here, fully unit-testable without Firestore mocks, and keeps all browsing logic in one place.

**Rejected — server-side Firestore queries:** requires per-field composite indexes, can't express type-aware AND filters cleanly, and pushes correctness into infrastructure that's hard to test. No benefit at this scale.

### Decision 2 — App-wide React Query (TanStack Query) for data caching

Introduce `QueryClientProvider` at the app root and convert **both** data readers to React Query:
- Home: catalogs + item counts.
- ListDetail: the `items(listId)` query.

- A single cached `items(listId)` query is the source the sheet and stats read from; filtering/sorting/stats are pure recomputations over cached data with **zero extra network**.
- `staleTime` prevents a refetch on every screen focus (replacing the current `useFocusEffect(load)` refetch-always pattern).
- Item create / edit / delete become mutations that `invalidateQueries` for the affected `items(listId)` (and Home counts), so views refresh automatically.

**Why:** fetch-then-derive is only as good as its cache — without one, every focus re-reads all items. React Query is the standard Expo/RN answer and gives caching, dedup, staleness, and mutation-driven invalidation for free.

**Rejected — DIY in-memory cache:** reinvents invalidation/staleness worse than a mature library.
**Rejected — ListDetail-only adoption:** leaves a split-brain data layer (two fetching patterns) in a small app; converting both readers now is cheap and keeps things consistent.

## Surfaces changed / added

| Surface | Change |
|---|---|
| `domain/itemQuery.ts` | **New.** Pure `applyQuery` + `computeStats`. Home of the browsing logic. |
| `components/FilterSortSheet.tsx` | **New.** Sort-by + type-aware filters + clear-all. Reuses `CatalogActionsSheet` animation pattern. |
| `components/CatalogStats.tsx` | **New.** Collapsible, filter-aware stats strip. |
| `screens/ItemDetailScreen.tsx` | **New.** Read-only detail; Edit + Delete; hides empty fields. |
| `navigation/RootNavigator.tsx` | Add `ItemDetail: { list; item }` route. |
| `screens/ListDetailScreen.tsx` | Control row → search + "Filter & sort" button; holds filter/sort state; renders `CatalogStats`; item tap → `ItemDetail`; reads via React Query. |
| `screens/HomeScreen.tsx` | Reads catalogs + counts via React Query. |
| `services/FirebaseCatalogRepository.ts` | Retire server-side search/sort in `getItems`; expose plain "all items for list". |
| App root (`App.tsx`) | Add `QueryClientProvider`. |

## Testing

Correctness lives in `itemQuery.ts`, so that gets the weight:
- **`domain/itemQuery.test.ts`** — filter operators per field type, multi-filter AND, each sort key + direction, empty/edge cases, and stats math (average, min/max, distribution, yes/no counts).
- Screens stay thin (state wiring + rendering); no heavy screen tests required.
- Existing `StarRating` / `validation` / repository tests continue to pass.

## Out of scope (deferred to later specs)

- **Localization (PT/EN)** — next batch; touches every screen's strings, orthogonal to browsing.
- **Catalog sharing** — its own project; rewrites the `{uid}`-scoped Firestore rules + Supabase RLS into a membership/ACL model.
- **Export / import**, **barcode autofill** — separate future specs.
