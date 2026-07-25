# Catalogify — Next Tasks

_Last updated: 2026-07-24. Current state: **Localization (PT/EN) merged to `main`** (merge commit `f765f0b`); `feat/localization` deleted. One branch still open: **`fix/listdetail-stale-schema`** (stale-schema fix, green, unmerged — awaiting the device batch-check below). Working tree clean. No git remote — everything is local._

> **⚠️ Next device build needs a dev-client REBUILD** — localization added `expo-localization` (native module); a JS reload won't pick it up. See the on-device checklist below.

## Project shape (quick orient)
- Expo / React Native + TypeScript personal catalog app. **Catalog lists/items → Firestore; item photos → Supabase Storage.**
- Styling: NativeWind (Tailwind classes). **Gotcha:** NativeWind resolves `className` by exact component reference — reanimated `Animated.*` and other non-base components need registration in `src/theme/nativewind-setup.ts` (or use inline `style`).
- Forms: all use `src/components/FormScreen.tsx` (wraps `react-native-keyboard-controller`'s `KeyboardAwareScrollView`; tune keyboard feel here once via `bottomOffset`).
- Workflow: this project is built via **SDD** (subagent implement → review per task); progress ledger at `.superpowers/sdd/progress.md`.
- Verify commands: `npx tsc --noEmit` and `npm test` (jest-expo `app` project; `emulator` project needs Android Studio JBR on PATH + local firebase-tools).
- i18n: **i18next + react-i18next**; strings in `src/i18n/locales/{pt,en}.json` (nested by area; `pt` is source of truth). `useTranslation()`/`t('area.key')` in screens. **Rule: every new key goes in BOTH json files** — `src/i18n/locales.test.ts` (key-parity) fails the build otherwise. Language picker in the new **Settings** screen (gear in Home header); switch is instant (no reload) + persisted to AsyncStorage. Watch for `t` shadowing in `.map((t) => …)` callbacks.
- Native modules requiring a **dev-client rebuild** (not Expo Go / not a JS reload): `expo-localization` (NEW — added by localization, not yet in the dev client), `@react-native-community/datetimepicker`, `@react-native-community/slider`, `react-native-keyboard-controller`, `@react-native-google-signin/google-signin`.

## On-device checklist — do these on the next dev build (dev-client REBUILD required)
- [ ] **Localization smoke (Task 12).** First launch: PT device → Portuguese UI; non-PT device → English. Settings (gear in Home header) → switch language → all screens re-render **instantly**, no reload; choice **survives restart**. Plural counts read right ("1 item"/"2 itens" PT; "1 item"/"2 items" EN) on Home tiles + stats bar. User content (catalog/field/item values) **unchanged** by language. Spot-check every screen for leftover English when in PT.
- [ ] **Verify cache-refresh-after-edit.** After editing/adding/deleting an item, the list + counts + stats update without leaving/re-entering. Invalidation in `src/hooks/useCatalogQueries.ts` (mutations call `invalidate()` before `goBack()`).
- [ ] **Loading-spinner fix (on `main`, commit `169598a`).** First (uncached) open of a catalog now shows a spinner instead of briefly flashing "This catalog is empty". Verify: open a catalog for the first time in a session → spinner → items (no empty-state flash). _Note: the catalog **stats bar** still momentarily shows 0s during that first load — minor, out of scope for this fix; flag if you want it gated too._
- [ ] **Stale-schema fix (on branch `fix/listdetail-stale-schema`).** `ListDetailScreen` now derives the live list from `useLists()` by id (was reading the nav snapshot), so editing a catalog's fields reflects on back-nav. Verify: ⋮ → Edit fields → rename a label/toggle sortable → Save → change shows immediately without re-opening. **Then merge the branch** (green: tsc 0, tests pass). NOTE: this branch is NOT on `main` yet — merge it after verifying, or merge now if you want it in the same build.

## Backlog (each is its own session; brainstorm before building)
- [ ] **Export / import** catalogs (e.g. JSON/CSV). — _next up; brainstorm started conceptually. Now that i18n exists, author its UI strings through `t(...)` from the start (keys in both pt.json/en.json)._
- [ ] **Catalog sharing.** Share a catalog with other users. Non-trivial: rewrites Firestore security rules + Supabase Storage RLS to a membership/ACL model. Treat as its own project.
- [ ] **Barcode scanning** to prefill item data.
- ✅ **Localization (PT/EN)** — DONE, merged `f765f0b` (i18next; Settings language picker; all screens migrated; key-parity test). On-device verify pending above.

## How to work here
1. Read this file + `.superpowers/sdd/progress.md` for history.
2. For a new feature: run the **brainstorming** skill first (design → approval), then **writing-plans**, then execute via **subagent-driven-development** (the established SDD loop). Small fixes can be done inline with `tsc` + tests verification.
3. UI/animation/keyboard changes have no unit-test surface — verify on device; the user runs the device build.
