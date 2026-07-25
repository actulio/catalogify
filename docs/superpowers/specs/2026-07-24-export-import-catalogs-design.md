# Export / Import Catalogs — Design

_Date: 2026-07-24 · Project: Catalogify (Expo RN + TypeScript)_

## Goal
Let a user export a single catalog to a portable, self-contained file and import it
back — on the same or a different account/device — with data and photos intact.

## Decisions (settled during brainstorming)
- **Scope:** one catalog at a time. In the domain, `CatalogList` *is* the catalog
  (a name + `fields[]` + its items). There is no grouping above it, so each
  export/import is exactly one `CatalogList` + its items + their photos.
- **Photos:** bundled into the export (zip). On import, photos are re-uploaded to the
  importer's own Supabase Storage with fresh URLs. Fully portable across accounts.
- **Data format:** JSON only (round-trip faithful). No CSV.
- **Import mode:** v1 **always creates a new catalog** with fresh IDs. Merge/replace is
  a future addition; the file format is versioned so future versions can add it without
  breaking v1 files.
- **Zip mechanism:** `fflate` (pure-JS, in-memory) — smallest native footprint, best
  testability. Personal catalogs are small (dozens of items), so in-memory is fine.
- **UX entry points:** Export lives in the per-catalog `CatalogActionsSheet`; Import
  lives in `SettingsScreen` under a new **Data** section.
- **Bandwidth protection:** limited-concurrency photo download (pool of 3), progress +
  cancel, and an in-flight guard. Photos are already size-capped on upload.
- **Cooldown:** a **shared** 10-minute cooldown across export+import, persisted to
  AsyncStorage (survives app restart).

## File format — `<catalog>-catalogify.zip`
```
data.json
images/cover.jpg          (optional — catalog cover)
images/0.jpg, 1.jpg, …    (optional — one per item that has a photo)
```
`data.json`:
```jsonc
{
  "formatVersion": 1,
  "app": "catalogify",
  "exportedAt": 1753370000000,
  "catalog": {
    "name": "Wines",
    "fields": [ /* FieldDef[] verbatim from src/domain/types.ts */ ],
    "coverImage": "images/cover.jpg"   // or null
  },
  "items": [
    {
      "title": "Barolo",
      "values": { "rating": 4, "vintage": 2016 },
      "image": "images/0.jpg",          // or null
      "createdAt": 1753370000000,
      "updatedAt": 1753370000000
    }
  ]
}
```
Notes:
- **IDs are omitted.** Import mints fresh list/item IDs → no id-collision handling needed.
- **`fields[]` travels verbatim**, so the imported catalog recreates its own schema.
  No schema-mismatch logic in v1 (the file is self-describing).
- **Timestamps are stored for forward-compat, but v1 sets imported items' creation date
  to import time** — import reuses `addItem`, which writes `serverTimestamp()`. Preserving
  original dates would require a new repository parameter; out of scope for v1. (Approved.)

## Architecture — three small units

### `src/services/catalogArchive.ts` (pure, fully unit-testable)
- `buildArchive(catalog, items, photoBytes): Uint8Array` — assembles `data.json` +
  `images/*` and zips with `fflate`.
- `parseArchive(zipBytes): ParsedArchive | ArchiveError` — unzips, validates
  `formatVersion` (reject version-too-new), validates JSON shape, returns
  `{ catalog, items, photos }`.
No I/O, no repository, no Expo modules → deterministic unit tests (zip/unzip round-trip,
schema validation, rejection of malformed / unsupported files).

### `src/services/catalogTransfer.ts` (orchestration)
- `exportCatalog(repo, listId, { onProgress, signal }): Promise<string /* temp zip uri */>`
  1. `repo.getLists()` → find the catalog; `repo.getItems(listId)`.
  2. Download each `photoUrl`/`coverUrl` to bytes via `mapWithConcurrency(…, 3, …, signal)`,
     reporting `onProgress({ phase: 'download', done, total })`.
  3. `buildArchive(...)` → write zip to a temp file (`expo-file-system`).
- `importCatalog(repo, zipBytes, { onProgress, signal }): Promise<CatalogList>`
  1. `parseArchive(zipBytes)` → validate or throw a typed error.
  2. Write photos from the archive to temp files.
  3. **Commit phase** (post-cancel): `repo.createList(name, fields, coverTempUri)` then
     `repo.addItem(newListId, title, values, photoTempUri)` per item. `createList`/`addItem`
     already resize + upload to Supabase → photos land in the importer's storage.
Owns temp files and cleanup. Depends on the existing `FirebaseCatalogRepository` — **no new
upload/download code in the repository**.

### `src/services/transferCooldown.ts`
- AsyncStorage-backed **shared** timer: `getRemainingMs()`, `start()`.
- In-memory in-flight guard so both buttons disable while any transfer runs.

### `src/services/concurrency.ts` (or inline helper)
- `mapWithConcurrency(items, limit, fn, signal)` — bounded-parallelism map with
  cancellation. Unit-tested (including cancel mid-flight).

## Flows

### Export
`CatalogActionsSheet` → "Export catalog" → progress UI ("Downloading n/N", cancel) →
`exportCatalog` → `expo-sharing` share sheet on the temp zip → `cooldown.start()`.

### Import
`SettingsScreen` → **Data** section → "Import catalog" → `expo-document-picker` → read bytes →
`importCatalog` (progress: parse/unzip → commit "Finishing…") → invalidate React Query cache
(catalog list + counts) so Home refreshes → `cooldown.start()`.

Cancellation is offered during download/unzip/prep. Once the Firestore commit phase begins,
the UI shows "Finishing…" and cancel is unavailable. A cancelled/failed import may leave a
partial catalog the user can delete (Firestore isn't transactional) — best-effort, matching
the repository's existing best-effort photo philosophy. (Approved.)

## Concurrency, cooldown, guards
- Photo download via `mapWithConcurrency(items, 3, …)` — caps peak bandwidth / Supabase egress.
- In-flight guard disables both actions while a transfer runs.
- Shared 10-minute cooldown afterward; buttons show remaining time; survives restart via
  AsyncStorage.

## Error handling
- Invalid / corrupt / `formatVersion`-too-new file → friendly i18n error, no crash.
- Export: a photo URL that 404s (object deleted) → that item exports with `image: null`,
  export continues (best-effort).
- Import: a photo upload failing → item created without photo, continues.

## i18n
- New keys under `transfer.*` and `settings.data*` in **both** `src/i18n/locales/pt.json`
  and `en.json` (pt is source of truth; `locales.test.ts` key-parity test enforces).
  Examples: `transfer.export`, `transfer.import`, `transfer.downloading`,
  `transfer.finishing`, `transfer.cancel`, `transfer.cooldownRemaining`,
  `transfer.invalidFile`, `transfer.unsupportedVersion`, `transfer.exportSuccess`,
  `transfer.importSuccess`, `settings.dataSection`.

## Dependencies (new — require dev-client rebuild)
Install via `expo install` for SDK-57 compatibility:
- `expo-file-system` — temp files, read/write bytes.
  ⚠️ **Expo SDK 57 reworked this module (new `File`/`Directory` API).** Pin the exact API
  against https://docs.expo.dev/versions/v57.0.0/ during planning.
- `expo-sharing` — OS share sheet (export).
- `expo-document-picker` — file picker (import).
- `fflate` — pure-JS zip/unzip.

## Testing
- **Unit:** `catalogArchive` build/parse round-trip; schema validation (reject malformed &
  version-too-new); `mapWithConcurrency` incl. cancellation; `transferCooldown` logic
  (mock AsyncStorage / fake timers).
- **No unit surface** for share-sheet / document-picker UI and real Supabase up/download →
  on-device verification (human), after the dev-client rebuild.
- Verify commands: `npx tsc --noEmit` and `npm test`.

## Out of scope (future)
- Merge / replace on import (name-match prompt).
- CSV export.
- Preserving original item creation timestamps.
- Multi-catalog / whole-app export.
