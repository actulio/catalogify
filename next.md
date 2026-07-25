# Catalogify — Next Tasks

_Last updated: 2026-07-24. Current state: all work on **`main`**, no open branches, working tree clean. Shipped **and device-verified** this session: **Localization (PT/EN)** (merge `f765f0b`), **loading-spinner fix** (`169598a`), **stale-schema fix** (`ce2569c`). No git remote — everything is local._

> **▶ NEXT WORK: Export / import catalogs** — see the "▶ START HERE" item under Backlog. Start with the **brainstorming** skill.

## Project shape (quick orient)
- Expo / React Native + TypeScript personal catalog app. **Catalog lists/items → Firestore; item photos → Supabase Storage.**
- Styling: NativeWind (Tailwind classes). **Gotcha:** NativeWind resolves `className` by exact component reference — reanimated `Animated.*` and other non-base components need registration in `src/theme/nativewind-setup.ts` (or use inline `style`).
- Forms: all use `src/components/FormScreen.tsx` (wraps `react-native-keyboard-controller`'s `KeyboardAwareScrollView`; tune keyboard feel here once via `bottomOffset`).
- Workflow: this project is built via **SDD** (subagent implement → review per task); progress ledger at `.superpowers/sdd/progress.md`.
- Verify commands: `npx tsc --noEmit` and `npm test` (jest-expo `app` project; `emulator` project needs Android Studio JBR on PATH + local firebase-tools).
- i18n: **i18next + react-i18next**; strings in `src/i18n/locales/{pt,en}.json` (nested by area; `pt` is source of truth). `useTranslation()`/`t('area.key')` in screens. **Rule: every new key goes in BOTH json files** — `src/i18n/locales.test.ts` (key-parity) fails the build otherwise. Language picker in the new **Settings** screen (gear in Home header); switch is instant (no reload) + persisted to AsyncStorage. Watch for `t` shadowing in `.map((t) => …)` callbacks.
- Native modules requiring a **dev-client rebuild** (not Expo Go / not a JS reload): `expo-localization` (NEW — added by localization, not yet in the dev client), `@react-native-community/datetimepicker`, `@react-native-community/slider`, `react-native-keyboard-controller`, `@react-native-google-signin/google-signin`.

## ✅ Verified on device 2026-07-24 (nothing to do — history)
- Localization (PT/EN): auto-detect, instant Settings switch, persist-across-restart, plural counts, user content untranslated — all confirmed.
- Cache-refresh-after-edit: add/edit/delete updates list + counts + stats in place.
- Loading-spinner fix (`169598a`): first open shows spinner, no empty-state flash.
- Stale-schema fix (`ce2569c`): field edits reflect on back-nav without re-opening.
- Stats-bar loading flash (`1f78cf6`): `CatalogStats` hidden during first uncached load (was flashing 0s). Green (tsc 0, 60 tests); eyeball on next build.

## Backlog (each is its own session; brainstorm before building)
- [ ] **▶ START HERE — Export / import catalogs (e.g. JSON/CSV).** The next feature. Not yet brainstormed — **run the `brainstorming` skill first** (unresolved design questions: which formats? whole-catalog vs. per-list? do item **photos** travel — they live in Supabase Storage, so export is either data-only or needs to bundle/relink image URLs? how does import handle schema/field mismatches and id collisions? share-sheet/file-picker vs. clipboard?). Reuse the domain layer: catalog/item shapes are in `src/domain/types.ts`; querying/deriving in `src/domain/itemQuery.ts`; data access in `src/services/FirebaseCatalogRepository.ts`. **i18n is live** — author all new UI strings via `t('area.key')` with keys in BOTH `pt.json`/`en.json` (parity test enforces). File I/O will likely need a new Expo native module (e.g. `expo-file-system`/`expo-sharing`/`expo-document-picker`) → **dev-client rebuild**.
- [ ] **Catalog sharing.** Share a catalog with other users. Non-trivial: rewrites Firestore security rules + Supabase Storage RLS to a membership/ACL model. Treat as its own project.
- [ ] **Barcode scanning** to prefill item data.
- ✅ **Localization (PT/EN)** — DONE + verified, merged `f765f0b`.

## How to work here
1. Read this file + `.superpowers/sdd/progress.md` for history.
2. For a new feature: run the **brainstorming** skill first (design → approval), then **writing-plans**, then execute via **subagent-driven-development** (the established SDD loop). Small fixes can be done inline with `tsc` + tests verification.
3. UI/animation/keyboard changes have no unit-test surface — verify on device; the user runs the device build.
