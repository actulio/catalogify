# Catalog cover images — Design

**Date:** 2026-07-23
**Status:** Approved (design)

## Problem

Catalog tiles on the home screen (`ListTile`) are plain `surface-container` cards showing only the catalog name and item count. The user wants a catalog's "face" to show an image — a per-catalog cover, like an album cover.

## Goal

Let a user set an optional cover image per catalog. Show it full-bleed on the catalog tile with the name/count overlaid; catalogs without a cover keep the current plain look. The cover is settable when creating a catalog and changeable later via edit. Deleting a catalog removes its cover from storage.

## Non-goals

- Auto-deriving the tile image from an item's photo (explicitly rejected in favor of a dedicated cover).
- Catalog renaming after creation (name stays create-only, unchanged).
- Making a cover required.
- Any change to item photos or the item form.

## Chosen approach

Reuse the existing item-photo pipeline (`expo-image-picker` → `resizeUnderSizeLimit` → Supabase upload → signed URL) for a catalog-level cover stored at `{uid}/lists/{listId}/cover.jpg`.

### 1. Data model

- Add `coverUrl?: string` to `CatalogList` (`src/domain/types.ts`).
- The Firestore list doc (`users/{uid}/lists/{listId}`) gains a `coverUrl` field (`string | null`).
- Cover object path in Supabase Storage: `{uid}/lists/{listId}/cover.jpg` — sits alongside the existing `{uid}/lists/{listId}/items/{itemId}/photo.jpg`.

### 2. Repository (`FirebaseCatalogRepository` + `CatalogRepository` interface)

- `uploadCover(listId, coverUri): Promise<string>` — private helper mirroring the existing `uploadPhoto`: resize via `resizeUnderSizeLimit`, `supabase.storage.from(PHOTOS_BUCKET).upload(coverPath, ..., { upsert: true })`, then `createSignedUrl`. Reuses `coverPath(listId)` = `{uid}/lists/{listId}/cover.jpg`.
- `createList(name, fields, coverUri?)` — extend the existing signature. If `coverUri` is provided, upload it and store `coverUrl`; otherwise `coverUrl: null`.
- `updateListCover(listId, coverUri): Promise<string>` — new interface method: upload the cover and `updateDoc({ coverUrl })`. Used by the edit path.
- `getLists()` — read `coverUrl: d.data().coverUrl` into each `CatalogList`.
- `deleteList()` — add the cover path to the existing best-effort `removePhotos([...])` batch, **unconditionally** (Supabase `remove` ignores missing paths, so it is a safe no-op for coverless catalogs and needs no branch).

`updateListFields` is unchanged (fields only). The edit screen calls it plus `updateListCover` separately when the cover changed.

### 3. `ListTile` (`src/components/ListTile.tsx`)

- No `coverUrl`: render exactly as today (plain `surface-container` card, dark text).
- With `coverUrl`: render the image absolutely-positioned, full-bleed, `resizeMode="cover"`, cropped to the existing `w-[48%] aspect-[4/5]` tile; a bottom **gradient scrim** (`expo-linear-gradient`, transparent → dark) behind the text; name + count in **white** over it.
- New dependency: `expo-linear-gradient` (installed via `npx expo install`) for the scrim.

### 4. `EditListFieldsScreen` (`src/screens/EditListFieldsScreen.tsx`)

- Add a "Cover" picker in the header area near "Catalog Identity", reusing the `expo-image-picker` flow from `ItemFormScreen.pickPhoto` (request permission, `launchImageLibraryAsync`, take `assets[0].uri`).
- State `coverUri` initialized from `existing?.coverUrl`. Show the current/picked image, or a dashed "Tap to add cover" placeholder when none.
- On save, using the same "image actually changed" check the item form uses (a newly-picked local uri does not start with `https://`):
  - **Create:** `createList(name.trim(), fields, coverChanged ? coverUri : undefined)`.
  - **Edit:** `updateListFields(existing.id, fields)`, then if `coverChanged`, `updateListCover(existing.id, coverUri)`.

### 5. Navigation params

`CatalogList` (now with `coverUrl`) already flows through `RootStackParamList` route params (Home → ListDetail → EditListFields). No route-param shape changes needed beyond the type gaining the optional field.

## Error handling

- Cover upload failures propagate to the existing `save()` try/catch in `EditListFieldsScreen`, which already shows an "Could not save" alert — consistent with item-photo save behavior. (Cover upload is part of an explicit user save, not a best-effort background task, so it is allowed to surface a failure — unlike the delete cleanup.)
- `deleteList` cover removal stays best-effort (logged, never blocks the delete), same as item-photo cleanup.

## Testing (emulator repo tests, `FirebaseCatalogRepository.test.ts`)

Mirror the existing supabase-storage mocking (`jest.spyOn(supabase.storage, 'from')`):
- `createList` with a `coverUri` stores a `coverUrl` that `getLists()` returns; without a `coverUri`, `coverUrl` is null/undefined.
- `updateListCover` uploads and updates the doc so `getLists()` reflects the new `coverUrl`.
- `deleteList` includes `{uid}/lists/{listId}/cover.jpg` in the storage `remove` batch (regression guard for the requirement that deleting a catalog deletes its cover).

## Caveats

- One new dependency (`expo-linear-gradient`). Standard Expo module; low risk.
- Cover upload reuses the 1 MB `MAX_PHOTO_BYTES` cap and resize attempts; covers are display-only so quality/size tradeoff matches item photos.

## Components summary

| Unit | Change | Responsibility |
|------|--------|----------------|
| `types.ts` | add `coverUrl?` | data model |
| `CatalogRepository.ts` | extend `createList`, add `updateListCover` | interface |
| `FirebaseCatalogRepository.ts` | `coverPath`, `uploadCover`, cover in create/getLists/deleteList, `updateListCover` | storage + Firestore |
| `ListTile.tsx` | full-bleed cover + gradient + white text | tile UI |
| `EditListFieldsScreen.tsx` | cover picker + wire create/edit | catalog form |
| `package.json` | add `expo-linear-gradient` | dep |
| `FirebaseCatalogRepository.test.ts` | cover create/read/update/delete-cleanup tests | tests |
