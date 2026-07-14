# Catalogify — Design Spec

Date: 2026-07-14

## Overview

A personal-use mobile app for cataloging collections — coffees, wines, fruits, or anything else — as user-defined lists. Each list has its own configurable form (fields beyond the always-required `title`), and items within a list can be searched, sorted, filtered, added, edited, and removed.

## Platform & Stack

- **React Native (Expo)**, Android-first — consistent with existing personal projects (VaultSync, Wallpaperfy) which use React Native 0.85.
- **Auth**: Google Sign-In (single personal account).
- **Backend**: Firebase — Firestore (data) + Cloud Storage (photos).
  - Firebase's free "Spark" tier is quota-based (daily reads/writes/storage caps), not time-limited — data is never deleted for inactivity. Personal cataloging use stays well under the daily caps.
  - Firestore's built-in offline persistence provides "local + cloud" behavior for free: reads/writes work offline and sync automatically when connectivity returns, with no hand-built sync engine needed.
- **Backend abstraction**: all data access goes through a `CatalogRepository` interface; screens never call Firebase directly. Today's implementation is `FirebaseCatalogRepository`. Switching backends later (e.g. Supabase, self-hosted) means writing a new class against the same interface — no UI changes.

## Data Model

```
users/{uid}/lists/{listId}
  name: string (required)
  fields: FieldDef[]           // ordered, user-defined schema beyond the implicit `title`
  createdAt: timestamp

users/{uid}/lists/{listId}/items/{itemId}
  title: string (required)     // always present, not part of `fields`
  values: { [fieldKey]: any }  // keyed to the list's fields at time of entry
  photoUrl?: string            // Cloud Storage download URL, if list has a photo field
  createdAt, updatedAt: timestamp
```

`FieldDef`:
```
{ key: string, label: string, type: FieldType, required: boolean, ratingScale?: { max: number, style?: "stars" } }
```

`FieldType` = `shortText | longText | number | rating | photo | boolean | date`. At most one `photo` field per list.

**Schema evolution**: list fields can be edited anytime (add/remove/reorder), even after items exist. Items simply render missing values as empty; removed fields leave orphaned data in `values` rather than triggering a migration.

## Screens

1. **Home ("My Catalogs")** — 2-column grid of catalog tiles, each with a gradient/photo thumbnail, name, item count, and a dashed "+" tile to create a new list.
2. **List detail** — search bar (title + text fields), sort/filter by rating, scrollable item cards (photo thumbnail, title, rating, secondary text), floating "+" to add an item.
3. **Item form (add/edit)** — dynamically rendered inputs from the list's field schema; shared between create and edit.
4. **Edit list schema** — same field-builder UI used at list creation; add/remove/reorder fields (type, label, required, rating scale).

Deleting a list warns that it removes all items; deleting an item is a simple confirm.

## Visual Direction — "Warm Editorial" (confirmed via visual companion)

- Cream background (`#FAF6F0`), white cards with soft shadows, generously rounded corners (12–18px)
- Serif headings (Georgia-style), warm brown/tan text (`#3A2E22` primary, `#8A7A68` secondary), tan/gold accents (`#C9A27A` / `#A8895F`)
- Photo-forward item cards (gradient placeholder until a real photo is set)
- Home screen uses a 2-column grid layout (chosen over a stacked list)
- Feels like a tasting journal / field notebook — warm and personal, not corporate or flat-minimal

Implementation should pull in `vercel-react-native-skills` and frontend/mobile design guidance to achieve this polish rather than default RN styling.

### External design-tool prompt (Google Stitch / Claude Design)

> **App: Catalogify — personal collection catalog app**
>
> A mobile app (Android/iOS, React Native) for cataloging personal collections — coffees tried, wines tasted, fruits eaten, etc. Users create custom lists, each with its own set of fields (text, rating, photo, etc.), then add/search/edit items within each list.
>
> **Visual style: "Warm Editorial"**
> - Warm, cream background (`#FAF6F0`), not stark white
> - White content cards with soft, subtle drop shadows (not flat, not heavy)
> - Serif typography for headings (Georgia or similar), clean sans-serif for body text
> - Warm brown/tan text tones (`#3A2E22` headings, `#8A7A68` secondary text), tan/gold accent color (`#C9A27A` / `#A8895F`)
> - Generously rounded corners (12–18px) on cards and buttons
> - Photo-forward: each item card leads with an image (or a warm gradient placeholder if no photo yet)
> - Feels like a tasting journal / field notebook — warm, personal, editorial — not corporate or flat-minimal
>
> **Screens to design:**
>
> 1. **Home screen** — "My Catalogs": a 2-column grid of catalog tiles (e.g. Coffees, Wines, Fruits), each tile showing a color-gradient thumbnail, catalog name, and item count. A dashed-border "+" tile at the end to create a new catalog.
> 2. **List detail screen** — inside one catalog (e.g. "Coffees"): a search bar at top, sort/filter controls (by rating), then a scrollable list of item cards. Each card: small square photo thumbnail, item title in serif, star or numeric rating, one line of secondary text (e.g. tasting notes). Floating "+" button to add a new item.
> 3. **Item form screen (add/edit)** — a form rendering fields dynamically: title (text input, required), photo picker with preview, star/numeric rating selector, short text fields, a longer multi-line "commentary" text area, save/cancel actions at the bottom.
> 4. **New list / edit fields screen** — a builder UI where the user names the list and adds fields one at a time, choosing a field type (short text, long text, number, rating, photo, yes/no, date) and label for each, with reorder/remove controls.
>
> Keep all screens visually consistent with the Warm Editorial palette and card style described above.

### Alternate exploration prompt (generate style options)

Use this instead of the above if you want the AI to propose visual directions rather than apply the confirmed Warm Editorial one:

> **App: Catalogify — personal collection catalog app**
>
> A mobile app (Android/iOS, React Native) for cataloging personal collections — coffees tried, wines tasted, fruits eaten, etc. Users create custom lists, each with its own set of fields (text, rating, photo, etc.), then add/search/edit items within each list.
>
> **Generate 3 distinct visual style directions** for this app — each with its own color palette, typography choice, and overall mood. Make the directions genuinely different from each other (e.g. one warm/editorial, one bold/minimal, one soft/playful, one dark/premium — pick any 3 that feel distinct), not just palette swaps of the same layout. For each direction, apply it consistently across the screens below and give the direction a short name.
>
> **Screens to design (for each style direction):**
>
> 1. **Home screen** — "My Catalogs": a 2-column grid of catalog tiles (e.g. Coffees, Wines, Fruits), each tile showing a thumbnail, catalog name, and item count. A "+" tile to create a new catalog.
> 2. **List detail screen** — inside one catalog (e.g. "Coffees"): a search bar, sort/filter controls (by rating), and a scrollable list of item cards (photo thumbnail, title, rating, one line of secondary text). A floating "+" button to add a new item.
> 3. **Item form screen (add/edit)** — a form with: title (required text input), photo picker with preview, star/numeric rating selector, short text fields, a longer multi-line "commentary" text area, save/cancel actions.
> 4. **New list / edit fields screen** — a builder UI where the user names the list and adds fields one at a time, choosing a field type (short text, long text, number, rating, photo, yes/no, date) and label, with reorder/remove controls.
>
> Keep information density and layout structure consistent across the 3 directions — only style (color, type, shape, texture) should vary.

## Image Handling

Client-side resize/compress via `expo-image-manipulator` on pick (camera or gallery via `expo-image-picker`) before upload: target ~1080px longest edge, JPEG quality ~0.7. Only the resized version is stored in Cloud Storage; the original is discarded.

## Error Handling

- **Offline actions**: handled transparently by Firestore's offline cache (optimistic writes, auto-sync on reconnect). Optional small "offline" indicator.
- **Photo upload failure**: item still saves with its other fields; photo upload retries in the background with a visible retry affordance on persistent failure.
- **Validation**: required fields (title always; others per schema) block save with inline errors, checked client-side.
- **Auth failure**: Google Sign-In errors show a retry screen; auth is required once, then Firestore cache covers offline use.

## Testing

Lightweight, matching a personal single-user app: unit tests for `CatalogRepository` (schema validation, field-value mapping) and the image resize utility, run against a Firestore emulator. No E2E suite — manual on-device verification, consistent with other personal RN projects.
