# Catalogify visual redesign

## Goal

Catalogify's five screens are functionally complete but visually barebones: flat
`StyleSheet` boxes, no shadows/borders for depth, text-glyph icons ("+"), solid-color
placeholder blocks instead of imagery, no empty/loading states. This redesign applies a
proper design system — sourced from Stitch-generated mockups — to all five screens
without changing behavior, data model, or navigation structure.

## Source material

Six Stitch screens were generated under a design system named **"Warm Archive"** and
downloaded (code + screenshot) to `~/Downloads/stitch_catalogify_visual_design_guide/`:

| Stitch folder | Maps to |
|---|---|
| `home_warm_archive_updated_nav` | `HomeScreen` |
| `list_detail_warm_archive_updated_nav` | `ListDetailScreen` |
| `list_builder_warm_archive_updated_nav` | `EditListFieldsScreen` |
| `catalog_actions_modal_warm_archive` | New: `CatalogActionsSheet` |
| `sign_in_warm_archive` | `SignInScreen` |
| `add_edit_item_warm_archive_v2` | `ItemFormScreen` |

`warm_archive/DESIGN.md` documents the system's brand principles, color roles,
typography, spacing, elevation, and shape rules. During execution these files get
copied into the project at `.stitch/designs/{screen}.html` / `.png`, matching the
convention the `stitch-react-native` skill expects (the project's Stitch MCP connection
is currently broken — tool discovery fails with `can't resolve reference
#/$defs/ScreenInstance from id #` — so this batch was fetched manually through Stitch's
web UI instead of the MCP's `get_screen` flow).

The Stitch MCP tools (`mcp__stitch__*`) did later become available mid-session; if
reused for any follow-up screens, treat that as a bonus, not a dependency — this spec
and its plan assume the manual-download path throughout.

## Scope

**In scope**: restyle all 5 existing screens (`SignInScreen`, `HomeScreen`,
`ListDetailScreen`, `ItemFormScreen`, `EditListFieldsScreen`) plus 2 new supporting
components (`CatalogActionsSheet`, `StarRating`).

**Out of scope**: no new screens, no navigation restructure (native-stack stays,
no tab bar), no backend/data-model changes, no new persisted features.

### Feature boundary ("visuals + easy wins")

Stitch's mockups bundle new product surface beyond a pure restyle. Decisions on what
to carry over:

- **Sort by Rating** — `ListDetailScreen` already sorts by rating in its repository
  query (`sortByRatingKey`, hardcoded `sortDirection: 'desc'`); expose this as a visible
  toggle control per the mockup. This is a UI-only change, no repository signature change.
- **Catalog actions** — the inline "Delete this list" text link is replaced by a
  `CatalogActionsSheet` bottom sheet, **wired to Delete only**. The mockup's Share,
  Export as CSV, and Duplicate actions are **not included** — no dead/disabled buttons,
  they're simply absent from the sheet.
- **Field type picker** — `EditListFieldsScreen`'s field-type selector becomes icon
  tiles (per `list_builder` mockup) instead of text chips. The mockup's "Theme Color"
  and "Default View" sections are **dropped** — no backing fields on `CatalogList`.
- **List tile imagery** — `HomeScreen` tiles stay **tonal color blocks**, not real
  photography. `CatalogList` has no cover-photo field, and deriving one (e.g. from an
  item's photo) means touching `FirebaseCatalogRepository.getLists()` — ruled out to
  keep this a pure styling-layer change. `ListDetailScreen` item cards **do** go
  photo-forward, since `CatalogItem.photoUrl` already exists.
- **Bottom tab bar** shown in the Home/ListDetail mockups is **not adopted** — the app
  keeps its current native-stack navigation.

## Design tokens ("Warm Archive")

Consolidated from `DESIGN.md` and the `tailwind.config` block embedded in each of the 6
`code.html` files. One inconsistency found across the source files: `sign_in_warm_archive`
sets `borderRadius.lg = 8px` while every other screen (and `DESIGN.md`'s own component
spec — "Standard Elements: buttons and input fields use a 4px radius") uses `4px`. The
sign-in file is treated as the outlier; canonical value is **4px**.

**Colors** (subset — full token set is in the Material-style scale in `DESIGN.md`):
| Token | Hex | Role |
|---|---|---|
| `surface` / `background` | `#FAF9F5` | App background |
| `surface-container-lowest` | `#FFFFFF` | Card background |
| `surface-container` | `#EFEEEA` | Subtle container / tertiary bg |
| `on-surface` | `#1B1C1A` | Primary text |
| `on-surface-variant` | `#55423E` | Secondary text |
| `primary` | `#97422F` | Accent / CTAs |
| `primary-container` | `#B65A44` | Strong accent (buttons) |
| `outline` / `outline-variant` | `#88726D` / `#DBC1BB` | Hairline borders |
| `error` | `#BA1A1A` | Danger / delete |

**Typography**: `Playfair Display` (serif) for all headings — `display-lg` 48/36px,
`headline-md` 32px, `headline-sm` 24px. `Inter` (sans) for body/labels — `body-lg` 18px,
`body-md` 16px, `label-md` 14px (uppercase, letter-spacing 0.05em), `label-sm` 12px.

**Spacing**: 8px base unit, 20px mobile margin, 24px gutter.

**Shape**: 4px radius on buttons/inputs, 8px on cards/modals, no pill shapes except
`full` (9999px) for badges/avatars.

**Elevation**: no shadows — depth via tonal surface layers and 1px hairline borders
(`outline` color at ~10-15% opacity) instead.

## Styling: NativeWind

Stitch's HTML already uses Tailwind utility classes bound to these exact tokens, so
adopting NativeWind turns the HTML→RN port into largely a tag-and-class swap rather than
a hand-translation to `StyleSheet` numbers.

- **Primary path**: NativeWind v4 (stable). Install `nativewind`, `tailwindcss`,
  `react-native-reanimated`, `react-native-safe-area-context`; add the NativeWind babel
  preset; `tailwind.config.js` seeded 1:1 from the merged Warm Archive tokens above.
- **Known risk**: the project runs Expo SDK 57 / RN 0.86 / React 19.2.3 — bleeding-edge
  enough that the project's own `AGENTS.md` flags it. NativeWind v4's babel/metro setup
  may hit peer-dependency conflicts on install.
- **Fallback**: if v4 install fails, use **NativeWind v5 (preview)** —
  `npx expo install nativewind@preview react-native-css@latest ...` — which uses a
  CSS-based approach (Tailwind v4 + PostCSS) instead of the babel plugin. This is
  resolved during execution by attempting v4 first and falling back on failure; it is
  not knowable in advance from documentation alone.
- `theme.ts` is kept but shrinks to a thin module of derived values for the few spots
  NativeWind's `className` can't reach: `TextInput`'s `placeholderTextColor` prop,
  `StatusBar` bar style, Android ripple color. These read from the same token values,
  not a hand-duplicated palette.

## Per-screen changes

- **SignInScreen**: centered "Catalogify" wordmark (Playfair Display), short tagline,
  single "Sign in with Google" button (`primary` fill). No other sign-in methods.
- **HomeScreen**: 2-column grid, tonal-block list tiles restyled with new tokens
  (rounded corners, hairline border, `headline-sm` title), dashed-border "+ New Catalog"
  tile per mockup.
- **ListDetailScreen**: restyled search bar, new "Sort by Rating" toggle, item cards
  become photo-forward (full-width photo, rating badge overlay, title, subtitle) —
  replacing the current 48×48-thumbnail row layout. FAB restyled. "Delete this list"
  link replaced by a header action opening `CatalogActionsSheet`.
- **ItemFormScreen**: same fields and validation logic, restyled per `add_edit_item`
  mockup — labeled sections, restyled photo picker, restyled inputs per field type.
- **EditListFieldsScreen**: restyled per `list_builder` mockup, icon-tile field-type
  picker replacing text chips (Theme Color / Default View sections excluded).

## New components

- **`CatalogActionsSheet`**: bottom-sheet modal, header + "Delete Catalog" (danger,
  with confirmation — reuses the existing `Alert.alert` confirm flow) + "Cancel".
- **`StarRating`**: display component for rating-type field values, replacing the
  current `'★'.repeat(...)` string construction in `ItemCard`.

## Architecture

In-place restyle, not the full atomic-design (`atoms/molecules/organisms`) rewrite the
`stitch-react-native` skill defaults to — disproportionate for a 5-screen app. Existing
screen files keep their current locations and names; `ItemCard.tsx` and `ListTile.tsx`
restyle in place. `CatalogActionsSheet` and `StarRating` are the only new files, added to
`src/components/`.

**Explicitly unchanged**: `src/domain/`, `src/services/` (including
`FirebaseCatalogRepository`), navigation param types, `RootNavigator.tsx` structure,
all business/validation logic. This is a styling-layer change only.

## Testing / verification

No new automated tests planned — this is a visual change with no logic modification, so
the existing Jest suite (`validation.test.ts`, `FirebaseCatalogRepository.test.ts`,
`image.test.ts`) should continue to pass unmodified and serves as a regression check that
no business logic broke. Manual verification via Expo (simulator or `expo start --web`)
against each of the 6 Stitch screenshots is the primary acceptance check.
