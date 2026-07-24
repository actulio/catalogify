# Catalogify — Localization (PT/EN) Design

_Date: 2026-07-24 · Status: approved design, pre-plan_

## Goal

Localize Catalogify's UI into **Portuguese (default)** and **English**. Portuguese
is the source-of-truth language; English mirrors it. Scope is **UI strings only** —
dates and numbers keep their current formatting, and user-generated content (catalog
names, field labels, item values) is never translated.

## Decisions (from brainstorming)

- **Language selection:** auto-detect device locale on first launch (Portuguese →
  `pt`, anything else → `en`), with a **manual override** that persists.
- **Override lives in:** a new **Settings screen**, reached via a gear icon in the
  Home header. Built to hold future preferences too.
- **Format scope:** UI strings only. No locale-aware date/number formatting.
- **Engine:** `i18next` + `react-i18next` — chosen for correct pluralization
  (the UI is count-heavy: items, catalogs, filters, stats) and interpolation, plus
  it scales to the upcoming export/sharing features.

## Architecture

### Dependencies
- `i18next`, `react-i18next` — JS-only, no native rebuild.
- `expo-localization` — **native module** → **dev-client rebuild required** before
  on-device testing. Verify the exact API against the pinned Expo v57 docs
  (`https://docs.expo.dev/versions/v57.0.0/`) during planning/implementation.
- `@react-native-async-storage/async-storage` — **already installed (2.2.0)**,
  reused for persistence.

### Initialization
- New `src/i18n/index.ts` initializes i18next once:
  - `fallbackLng: 'pt'`
  - `lng` resolved at startup (see Language resolution)
  - `interpolation.escapeValue: false` (RN needs no HTML escaping)
  - both resource bundles registered
- Imported once at the top of `App.tsx` (before the provider tree renders), mirroring
  how `src/theme/nativewind-setup.ts` is imported.

### String organization
- `src/i18n/locales/pt.json` and `src/i18n/locales/en.json`.
- **PT authored first** as the source of truth; EN mirrors its key set exactly.
- Namespaced by screen plus a shared `common`:
  `common` (save/cancel/delete, generic alerts), `home`, `listDetail`, `itemForm`,
  `itemDetail`, `editFields`, `signIn`, `settings`.
- **Plurals** via i18next suffix convention (`item_one`/`item_other`,
  `catalog_one`/`catalog_other`, …) with `{{count}}`.
- **Interpolation** for dynamic strings, e.g. the delete confirmation:
  `"This removes \"{{name}}\" and all its items permanently."`

### Language resolution, persistence & switching
- AsyncStorage key: `@catalogify/lang`.
- **Startup resolution:**
  1. If a stored value exists → use it.
  2. Else read `Localization.getLocales()[0].languageCode` → `pt` if Portuguese,
     else `en`; persist the resolved default.
- **Provider:** an `I18nProvider` (thin wrapper over react-i18next's context, or a
  small context) exposes `language` and `setLanguage(lng)`.
- **`setLanguage(lng)`** calls `i18n.changeLanguage(lng)` (instantly re-renders all
  `useTranslation` consumers — no app reload) and writes the choice to AsyncStorage.
- Startup detection is async → `App.tsx` gates the tree on an `i18nReady` flag to
  avoid a flash of the wrong language.

### Settings screen
- New `src/screens/SettingsScreen.tsx` + a `Settings` route in
  `src/navigation/RootNavigator.tsx`.
- Reached via a **gear icon in the Home header** (`headerRight`, mirroring the
  existing `headerRight` pattern in `ListDetailScreen`).
- Content: a "Idioma / Language" section with two selectable rows (Português,
  English); a check marks the active language. Styled with existing NativeWind tokens.
  Structured to hold future preference sections.

## String migration
Replace hardcoded user-facing strings across the 6 screens and their components with
`t('namespace:key')` calls via `useTranslation`. Surfaces include: `Text` content,
`placeholder`s, `Alert.alert` titles/messages, empty-state copy, accessibility
labels, and navigation header titles/options.

## Testing

### Unit (jest-expo `app` project)
- **Key-parity test:** assert `pt.json` and `en.json` have identical key sets
  (recursively) — catches any missing/extra translation. Cheap, high value.
- **Resolution-logic test:** stored value wins → else device locale → else `pt`
  fallback. Mock AsyncStorage and expo-localization.

### On-device (human, per project convention)
- **Dev-client rebuild required** (expo-localization is native).
- First launch on a PT device shows Portuguese; on a non-PT device shows English.
- Settings → switch language → **all visible screens re-render immediately** (no
  reload); the choice survives an app restart.
- Spot-check pluralized counts in both languages (e.g. "1 item" / "2 itens").
- Confirm user content (catalog/field/item values) is unchanged by language.

## Scope guardrails (YAGNI)
- UI strings only — no date/number localization.
- Exactly two locales: PT (default) + EN.
- User-generated content is never translated.
- Settings screen ships only the language section now (structured for later, not
  pre-built).

## Follow-on
Export feature (separate spec/session) will author its user-facing strings through
this i18n layer from the start, so it is localized without retrofit.
