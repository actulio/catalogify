# Catalogify — Next Tasks

_Last updated: 2026-07-24. Current state: `feat/catalog-browsing` merged to `main` (merge commit `1637bb2`); branch deleted. Working tree clean. No git remote — everything is local._

## Project shape (quick orient)
- Expo / React Native + TypeScript personal catalog app. **Catalog lists/items → Firestore; item photos → Supabase Storage.**
- Styling: NativeWind (Tailwind classes). **Gotcha:** NativeWind resolves `className` by exact component reference — reanimated `Animated.*` and other non-base components need registration in `src/theme/nativewind-setup.ts` (or use inline `style`).
- Forms: all use `src/components/FormScreen.tsx` (wraps `react-native-keyboard-controller`'s `KeyboardAwareScrollView`; tune keyboard feel here once via `bottomOffset`).
- Workflow: this project is built via **SDD** (subagent implement → review per task); progress ledger at `.superpowers/sdd/progress.md`.
- Verify commands: `npx tsc --noEmit` and `npm test` (jest-expo `app` project; `emulator` project needs Android Studio JBR on PATH + local firebase-tools).
- Native modules requiring a **dev-client rebuild** (not Expo Go / not a JS reload): `@react-native-community/datetimepicker`, `@react-native-community/slider`, `react-native-keyboard-controller`, `@react-native-google-signin/google-signin`. The current dev client already has all of these.

## Loose ends from the last milestone
- [ ] **Verify cache-refresh-after-edit on device.** After editing/adding/deleting an item, the list + counts + stats should update without leaving/re-entering. React Query invalidation lives in `src/hooks/useCatalogQueries.ts` (mutations call `invalidate()` before `navigation.goBack()`). This was the one flow left unverified at merge.
- [ ] **Known quirk — stale schema in ListDetail.** `ListDetailScreen` reads the catalog schema from a navigation snapshot (`route.params`), so editing a catalog's fields (labels/types/`sortable`) doesn't reflect until the catalog is re-opened. Fix = source the list/schema from React Query instead of the nav param. Small, self-contained.

## Backlog (each is its own session; brainstorm before building)
- [ ] **Localization (PT/EN).** Personal apps target **Portuguese as default** + English. No i18n scaffolding exists yet — pick a lib, extract strings.
- [ ] **Catalog sharing.** Share a catalog with other users. Non-trivial: rewrites Firestore security rules + Supabase Storage RLS to a membership/ACL model. Treat as its own project.
- [ ] **Export / import** catalogs (e.g. JSON/CSV).
- [ ] **Barcode scanning** to prefill item data.

## How to work here
1. Read this file + `.superpowers/sdd/progress.md` for history.
2. For a new feature: run the **brainstorming** skill first (design → approval), then **writing-plans**, then execute via **subagent-driven-development** (the established SDD loop). Small fixes can be done inline with `tsc` + tests verification.
3. UI/animation/keyboard changes have no unit-test surface — verify on device; the user runs the device build.
