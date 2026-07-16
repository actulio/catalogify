# Catalogify Warm Archive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 5 Catalogify screens (SignIn, Home, ListDetail, ItemForm, EditListFields) plus 2 new supporting components with the "Warm Archive" design system extracted from Stitch-generated mockups, using NativeWind — with zero changes to business logic, data model, or navigation structure.

**Architecture:** Configure NativeWind (Tailwind for React Native) against a `tailwind.config.js` seeded 1:1 from the Stitch tokens, load the two required Google Fonts, then restyle each file in place — swapping `StyleSheet.create()` for `className`, keeping every handler/state/prop signature untouched. Two new small components (`StarRating`, `CatalogActionsSheet`) get proper TDD; the screen restyles are visual-only and are verified by typecheck + a headless Expo web export + a final manual pass against the Stitch screenshots.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2.3, NativeWind v4, Tailwind CSS v3, `@expo-google-fonts/*`, `@expo/vector-icons`, existing Jest/jest-expo suite.

**Spec:** `docs/superpowers/specs/2026-07-15-catalogify-redesign-design.md`

---

## File Structure

**New files:**
- `babel.config.js` — NativeWind babel preset
- `metro.config.js` — NativeWind metro wrapper
- `tailwind.config.js` — Warm Archive design tokens (single source of truth)
- `global.css` — Tailwind directives
- `nativewind-env.d.ts` — NativeWind types + ambient prop declarations for FlatList/ScrollView/TextInput className extensions
- `src/theme/nativewind-setup.ts` — runtime `remapProps`/`cssInterop` registration (side-effect import)
- `src/theme/useAppFonts.ts` — font-loading hook
- `src/components/StarRating.tsx` + `src/components/StarRating.test.ts` — new display component
- `src/components/CatalogActionsSheet.tsx` — new bottom-sheet component
- `.stitch/designs/*.html` + `*.png` (6 screens) — copied Stitch reference material
- `.stitch/metadata.json` — hand-authored project metadata (MCP `get_project` unavailable)

**Modified files:**
- `package.json` — new dependencies
- `App.tsx` — import `global.css` + `nativewind-setup`, font-loading gate
- `src/theme/theme.ts` — shrinks to 4 hex values used as native props (icon `color`, `Switch.trackColor`) that `className` can't reach
- `src/components/ListTile.tsx`, `src/components/ItemCard.tsx` — restyle in place
- `src/screens/HomeScreen.tsx`, `SignInScreen.tsx`, `ListDetailScreen.tsx`, `ItemFormScreen.tsx`, `EditListFieldsScreen.tsx` — restyle in place

**Explicitly untouched:** `src/domain/`, `src/services/`, `src/navigation/RootNavigator.tsx` (types/structure), all Jest test files (they cover logic, not styling, and keep passing unmodified as a regression check).

---

## Task 1: Install and configure NativeWind

**Files:**
- Modify: `package.json`
- Create: `babel.config.js`
- Create: `metro.config.js`
- Create: `tailwind.config.js`
- Create: `global.css`
- Create: `nativewind-env.d.ts`
- Create: `src/theme/nativewind-setup.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npx expo install nativewind tailwindcss react-native-reanimated @expo/vector-icons
```
Expected: adds `nativewind`, `tailwindcss`, `react-native-reanimated`, `@expo/vector-icons` to `package.json` dependencies (versions chosen by `expo install` for SDK 57 compatibility). `react-native-safe-area-context` is already a dependency — no action needed there.

- [ ] **Step 2: Pin Tailwind to v3 (NativeWind v4 requires Tailwind v3, not v4)**

Check what `expo install` resolved:
```bash
cat package.json | grep '"tailwindcss"'
```
If it resolved to a `^4.x` version, fix it:
```bash
pnpm add -D tailwindcss@^3.4.0
```
Expected: `package.json` shows `"tailwindcss": "^3.4.0"` (or another 3.x) in `devDependencies`.

- [ ] **Step 3: Create `babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

- [ ] **Step 4: Create `metro.config.js`**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 5: Create `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create `tailwind.config.js` with the Warm Archive tokens**

Colors and typography are taken verbatim from `warm_archive/DESIGN.md`'s YAML token block (the canonical source — see the design spec's "Design tokens" section). `borderRadius.lg` is normalized to `4px` (the spec documents `sign_in_warm_archive`'s `8px` as an outlier in Stitch's own output). `fontFamily` values are RN-loadable per-weight font names (see Task 2) rather than Stitch's web-style family+fontWeight pairing — RN can't apply a numeric `fontWeight` on top of a specific font file without risking synthesized double-bold, so `fontWeight` is intentionally omitted from the `fontSize` tuples below.

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surface: '#faf9f5',
        'surface-dim': '#dbdad6',
        'surface-bright': '#faf9f5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f4f4f0',
        'surface-container': '#efeeea',
        'surface-container-high': '#e9e8e4',
        'surface-container-highest': '#e3e2df',
        'on-surface': '#1b1c1a',
        'on-surface-variant': '#55423e',
        'inverse-surface': '#2f312e',
        'inverse-on-surface': '#f2f1ed',
        outline: '#88726d',
        'outline-variant': '#dbc1bb',
        'surface-tint': '#9a4431',
        primary: '#97422f',
        'on-primary': '#ffffff',
        'primary-container': '#b65a44',
        'on-primary-container': '#fffbff',
        'inverse-primary': '#ffb4a3',
        secondary: '#675c58',
        'on-secondary': '#ffffff',
        'secondary-container': '#ecddd8',
        'on-secondary-container': '#6b605d',
        tertiary: '#5e5c53',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#77746b',
        'on-tertiary-container': '#fffbff',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        background: '#faf9f5',
        'on-background': '#1b1c1a',
        'surface-variant': '#e3e2df',
      },
      fontFamily: {
        'display-lg': ['PlayfairDisplay_700Bold'],
        'display-lg-mobile': ['PlayfairDisplay_700Bold'],
        'headline-md': ['PlayfairDisplay_600SemiBold'],
        'headline-sm': ['PlayfairDisplay_600SemiBold'],
        'body-lg': ['Inter_400Regular'],
        'body-md': ['Inter_400Regular'],
        'label-md': ['Inter_600SemiBold'],
        'label-sm': ['Inter_500Medium'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg-mobile': ['36px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'headline-md': ['32px', { lineHeight: '1.3' }],
        'headline-sm': ['24px', { lineHeight: '1.4' }],
        'body-lg': ['18px', { lineHeight: '1.6' }],
        'body-md': ['16px', { lineHeight: '1.5' }],
        'label-md': ['14px', { lineHeight: '1', letterSpacing: '0.05em' }],
        'label-sm': ['12px', { lineHeight: '1' }],
      },
      borderRadius: {
        DEFAULT: '2px',
        lg: '4px',
        xl: '8px',
        full: '9999px',
      },
      spacing: {
        unit: '8px',
        'margin-mobile': '20px',
        'margin-desktop': '64px',
        gutter: '24px',
      },
      maxWidth: {
        'container-max': '1120px',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 7: Create `nativewind-env.d.ts`**

FlatList's `columnWrapperClassName`/`contentContainerClassName`, ScrollView's `contentContainerClassName`, and TextInput's `placeholderClassName` are not part of NativeWind's default className surface — they need both a runtime registration (Step 8) and this type declaration.

```typescript
/// <reference types="nativewind/types" />

declare module 'react-native' {
  interface FlatListProps<ItemT> {
    columnWrapperClassName?: string;
    contentContainerClassName?: string;
  }
  interface ScrollViewProps {
    contentContainerClassName?: string;
  }
  interface TextInputProps {
    placeholderClassName?: string;
  }
}

export {};
```

- [ ] **Step 8: Create `src/theme/nativewind-setup.ts`**

```typescript
// Registers extra className props NativeWind doesn't map by default.
// Must be imported once, for its side effects, before any screen renders.
import { FlatList, ScrollView, TextInput } from 'react-native';
import { remapProps, cssInterop } from 'nativewind';

remapProps(FlatList, {
  columnWrapperClassName: 'columnWrapperStyle',
  contentContainerClassName: 'contentContainerStyle',
});

remapProps(ScrollView, {
  contentContainerClassName: 'contentContainerStyle',
});

cssInterop(TextInput, {
  placeholderClassName: {
    target: false,
    nativeStyleToProp: { color: 'placeholderTextColor' },
  },
});
```

- [ ] **Step 9: Wire it up in `App.tsx`**

```tsx
import './global.css';
import './src/theme/nativewind-setup';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}
```

(The font-loading gate is added on top of this in Task 2 — this step alone should still typecheck and build.)

- [ ] **Step 10: Verify the pipeline compiles**

Run:
```bash
pnpm test
npx tsc --noEmit
npx expo export --platform web --output-dir /private/tmp/claude-502/-Users-work-personal-random/fdeece4c-0ce6-424b-aba5-a29b677bc34d/scratchpad/catalogify-export-check
```
Expected: all three exit 0. The `expo export` command is a headless bundler smoke test — it doesn't need a simulator/device and will surface any babel/metro/tailwind misconfiguration immediately (e.g. a missing `global.css`, a bad `withNativeWind` input path, or the wrong Tailwind major version from Step 2).

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml babel.config.js metro.config.js tailwind.config.js global.css nativewind-env.d.ts src/theme/nativewind-setup.ts App.tsx
git commit -m "chore: configure NativeWind with Warm Archive design tokens"
```

---

## Task 2: Load Warm Archive fonts (Playfair Display + Inter)

**Files:**
- Create: `src/theme/useAppFonts.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Install the font packages**

```bash
npx expo install expo-font
pnpm add @expo-google-fonts/playfair-display @expo-google-fonts/inter
```

- [ ] **Step 2: Create `src/theme/useAppFonts.ts`**

```typescript
import {
  useFonts as usePlayfairDisplayFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

export function useAppFonts(): boolean {
  const [playfairLoaded] = usePlayfairDisplayFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return playfairLoaded && interLoaded;
}
```

- [ ] **Step 3: Gate rendering on font load in `App.tsx`**

```tsx
import './global.css';
import './src/theme/nativewind-setup';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppFonts } from './src/theme/useAppFonts';

export default function App() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) return null;

  return <RootNavigator />;
}
```

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit
```
Expected: exits 0. (Visual confirmation that the fonts actually render happens in Task 14's manual check — font loading has no meaningful way to fail loudly at the type level beyond a bad import.)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/theme/useAppFonts.ts App.tsx
git commit -m "feat: load Playfair Display and Inter fonts"
```

---

## Task 3: Copy Stitch design references into the project

**Files:**
- Create: `.stitch/designs/{home,list_detail,list_builder,catalog_actions_modal,sign_in,add_edit_item}.{html,png}`
- Create: `.stitch/metadata.json`

- [ ] **Step 1: Copy the files**

```bash
mkdir -p .stitch/designs
cp ~/Downloads/stitch_catalogify_visual_design_guide/home_warm_archive_updated_nav/code.html .stitch/designs/home.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/home_warm_archive_updated_nav/screen.png .stitch/designs/home.png
cp ~/Downloads/stitch_catalogify_visual_design_guide/list_detail_warm_archive_updated_nav/code.html .stitch/designs/list_detail.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/list_detail_warm_archive_updated_nav/screen.png .stitch/designs/list_detail.png
cp ~/Downloads/stitch_catalogify_visual_design_guide/list_builder_warm_archive_updated_nav/code.html .stitch/designs/list_builder.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/list_builder_warm_archive_updated_nav/screen.png .stitch/designs/list_builder.png
cp ~/Downloads/stitch_catalogify_visual_design_guide/catalog_actions_modal_warm_archive/code.html .stitch/designs/catalog_actions_modal.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/catalog_actions_modal_warm_archive/screen.png .stitch/designs/catalog_actions_modal.png
cp ~/Downloads/stitch_catalogify_visual_design_guide/sign_in_warm_archive/code.html .stitch/designs/sign_in.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/sign_in_warm_archive/screen.png .stitch/designs/sign_in.png
cp ~/Downloads/stitch_catalogify_visual_design_guide/add_edit_item_warm_archive_v2/code.html .stitch/designs/add_edit_item.html
cp ~/Downloads/stitch_catalogify_visual_design_guide/add_edit_item_warm_archive_v2/screen.png .stitch/designs/add_edit_item.png
```
Expected:
```bash
ls .stitch/designs | wc -l
```
prints `12`.

- [ ] **Step 2: Create `.stitch/metadata.json`**

```json
{
  "projectId": "manual-download",
  "title": "Catalogify — Warm Archive",
  "deviceType": "mobile",
  "lastSyncTime": "2026-07-15T00:00:00Z",
  "screens": {
    "home": { "sourceScreen": "home_warm_archive_updated_nav", "mapsTo": "HomeScreen" },
    "list_detail": { "sourceScreen": "list_detail_warm_archive_updated_nav", "mapsTo": "ListDetailScreen" },
    "list_builder": { "sourceScreen": "list_builder_warm_archive_updated_nav", "mapsTo": "EditListFieldsScreen" },
    "catalog_actions_modal": { "sourceScreen": "catalog_actions_modal_warm_archive", "mapsTo": "CatalogActionsSheet" },
    "sign_in": { "sourceScreen": "sign_in_warm_archive", "mapsTo": "SignInScreen" },
    "add_edit_item": { "sourceScreen": "add_edit_item_warm_archive_v2", "mapsTo": "ItemFormScreen" }
  },
  "note": "Fetched manually via Stitch's web UI, not the MCP get_screen flow — the project's Stitch MCP connection fails tool discovery (can't resolve reference #/$defs/ScreenInstance from id #). See docs/superpowers/specs/2026-07-15-catalogify-redesign-design.md."
}
```

- [ ] **Step 3: Commit**

```bash
git add .stitch/
git commit -m "docs: add Stitch Warm Archive design references"
```

---

## Task 4: Shrink `theme.ts` to a thin non-className module

**Files:**
- Modify: `src/theme/theme.ts`

The only RN props later tasks need that `className` can't reach are `@expo/vector-icons`' `color` prop and `Switch.trackColor` — 4 hex values total. Everything else (backgrounds, text color, spacing, radii, fonts) comes from `tailwind.config.js` via `className`.

- [ ] **Step 1: Replace `src/theme/theme.ts`**

```typescript
// Non-className values for the few RN props NativeWind's `className` can't
// reach: @expo/vector-icons' `color` prop and Switch.trackColor.
// tailwind.config.js remains the single source of truth for all Warm Archive
// tokens — these are kept in sync with it by hand, since there's no
// cross-runtime way to import Tailwind config values into plain JS props.
export const theme = {
  colors: {
    primary: '#97422f',
    onSurfaceVariant: '#55423e',
    outline: '#88726d',
    danger: '#ba1a1a',
  },
} as const;

export type Theme = typeof theme;
```

- [ ] **Step 2: Verify nothing else references the old shape yet**

Run:
```bash
npx tsc --noEmit
```
Expected: **fails** — every screen still imports the old `theme.spacing`/`theme.radii`/`theme.fonts`/`theme.colors.background` shape via `StyleSheet.create()`. This is expected; each of Tasks 6–13 removes one file's dependency on the old shape. Do not attempt to fix the other files here.

- [ ] **Step 3: Commit**

```bash
git add src/theme/theme.ts
git commit -m "refactor: shrink theme.ts to non-className values only"
```

---

## Task 5: `StarRating` component

**Files:**
- Create: `src/components/StarRating.tsx`
- Test: `src/components/StarRating.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/StarRating.test.ts
import { getStarStates } from './StarRating';

describe('getStarStates', () => {
  it('marks the first `rating` stars as filled and the rest empty', () => {
    expect(getStarStates(3, 5)).toEqual(['filled', 'filled', 'filled', 'empty', 'empty']);
  });

  it('clamps a rating above max down to max', () => {
    expect(getStarStates(8, 5)).toEqual(['filled', 'filled', 'filled', 'filled', 'filled']);
  });

  it('clamps a negative rating up to zero', () => {
    expect(getStarStates(-2, 5)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });

  it('returns an empty array when max is zero', () => {
    expect(getStarStates(3, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- StarRating`
Expected: FAIL — `Cannot find module './StarRating'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `src/components/StarRating.tsx`**

```tsx
import { View, Text } from 'react-native';

export function getStarStates(rating: number, max: number): ('filled' | 'empty')[] {
  const clamped = Math.max(0, Math.min(rating, max));
  return Array.from({ length: max }, (_, i) => (i < clamped ? 'filled' : 'empty'));
}

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

export function StarRating({ rating, max = 5, size = 14 }: StarRatingProps) {
  const stars = getStarStates(rating, max);

  return (
    <View className="flex-row items-center gap-0.5">
      {stars.map((state, index) => (
        <Text
          key={index}
          style={{ fontSize: size }}
          className={state === 'filled' ? 'text-primary' : 'text-outline-variant'}
        >
          ★
        </Text>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test -- StarRating`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: same failures as end of Task 4 (other screens), no *new* failures involving `StarRating.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/StarRating.tsx src/components/StarRating.test.ts
git commit -m "feat: add StarRating display component"
```

---

## Task 6: `CatalogActionsSheet` component

Per the spec's feature-boundary decision: only "Delete Catalog" and "Cancel" — Stitch's Share/Export/Duplicate rows are intentionally not included.

**Files:**
- Create: `src/components/CatalogActionsSheet.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface CatalogActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function CatalogActionsSheet({ visible, onClose, onDelete }: CatalogActionsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-on-background/40">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityLabel="Close catalog actions"
          accessibilityRole="button"
        />
        <View className="bg-background rounded-t-xl pb-8">
          <View className="items-center pt-3 pb-2">
            <View className="w-12 h-1 rounded-full bg-secondary/20" />
          </View>
          <View className="px-5 py-4 border-b border-outline-variant/40 items-center">
            <Text className="font-headline-sm text-headline-sm text-on-background">Catalog Actions</Text>
          </View>
          <Pressable
            onPress={onDelete}
            className="flex-row items-center gap-4 px-5 py-5"
            accessibilityRole="button"
            accessibilityLabel="Delete Catalog"
          >
            <MaterialIcons name="delete" size={22} color={theme.colors.danger} />
            <Text className="font-body-lg text-body-lg text-error">Delete Catalog</Text>
          </Pressable>
          <View className="px-5 pt-2">
            <Pressable
              onPress={onClose}
              className="w-full py-4 rounded-lg bg-surface-container-highest items-center"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="font-label-md text-label-md text-on-surface-variant">CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new failures involving `CatalogActionsSheet.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/CatalogActionsSheet.tsx
git commit -m "feat: add CatalogActionsSheet component (delete-only)"
```

---

## Task 7: Restyle `ListTile.tsx`

Per the spec's "List tile imagery" decision: tonal block, not real photography (no cover-photo field exists on `CatalogList`).

**Files:**
- Modify: `src/components/ListTile.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Pressable, Text } from 'react-native';
import { CatalogList } from '../domain/types';

interface Props {
  list: CatalogList;
  itemCount: number;
  onPress: () => void;
}

export function ListTile({ list, itemCount, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 aspect-[4/5] bg-surface-container rounded-lg overflow-hidden justify-end p-4"
    >
      <Text className="font-headline-sm text-headline-sm text-on-surface" numberOfLines={2}>
        {list.name}
      </Text>
      <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-tighter mt-1">
        {itemCount} items
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `ListTile.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListTile.tsx
git commit -m "style: restyle ListTile with Warm Archive tokens"
```

---

## Task 8: Restyle `ItemCard.tsx`

Photo-forward per the spec (item photos already exist on `CatalogItem`, unlike list covers). Uses `StarRating` from Task 5 instead of the old `'★'.repeat(...)` string.

**Files:**
- Modify: `src/components/ItemCard.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Pressable, Text, View, Image } from 'react-native';
import { CatalogItem, CatalogList } from '../domain/types';
import { StarRating } from './StarRating';

interface Props {
  item: CatalogItem;
  list: CatalogList;
  onPress: () => void;
}

export function ItemCard({ item, list, onPress }: Props) {
  const ratingField = list.fields.find((f) => f.type === 'rating');
  const rating = ratingField ? item.values[ratingField.key] : undefined;
  const secondaryField = list.fields.find((f) => f.type === 'shortText' || f.type === 'longText');
  const secondary = secondaryField ? item.values[secondaryField.key] : undefined;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden mb-4"
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} className="w-full h-48" resizeMode="cover" />
      ) : (
        <View className="w-full h-48 bg-surface-container items-center justify-center">
          <Text className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            No photo
          </Text>
        </View>
      )}
      <View className="p-4 gap-2">
        <Text className="font-headline-sm text-headline-sm text-on-surface" numberOfLines={2}>
          {item.title}
        </Text>
        {rating !== undefined && rating !== null && (
          <StarRating rating={Number(rating)} max={ratingField?.ratingScale?.max ?? 5} size={13} />
        )}
        {secondary ? (
          <Text className="font-body-md text-body-md text-on-surface-variant" numberOfLines={2}>
            {String(secondary)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `ItemCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemCard.tsx
git commit -m "style: restyle ItemCard with photo-forward layout and StarRating"
```

---

## Task 9: Restyle `HomeScreen.tsx`

Native-stack header (title "My Catalogs") is left untouched — Stitch's in-body "My Catalogs" section heading would be redundant with it, and customizing the header is out of scope ("no navigation restructure").

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogList } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ListTile } from '../components/ListTile';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<CatalogList[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const repo = new FirebaseCatalogRepository(user.uid);
      repo.getLists().then(setLists);
    }, [user])
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={[...lists, null]}
        keyExtractor={(item, index) => item?.id ?? `add-${index}`}
        numColumns={2}
        columnWrapperClassName="gap-4"
        contentContainerClassName="p-5 gap-4"
        renderItem={({ item }) =>
          item ? (
            <ListTile
              list={item}
              itemCount={0}
              onPress={() => navigation.navigate('ListDetail', { list: item })}
            />
          ) : (
            <Pressable
              className="flex-1 aspect-[4/5] rounded-lg border-2 border-dashed border-outline-variant items-center justify-center gap-3"
              onPress={() => navigation.navigate('EditListFields', {})}
            >
              <View className="w-14 h-14 rounded-full bg-surface-container items-center justify-center">
                <MaterialIcons name="add" size={26} color={theme.colors.outline} />
              </View>
              <Text className="font-label-md text-label-md text-secondary uppercase tracking-widest">
                New Catalog
              </Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `HomeScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "style: restyle HomeScreen with Warm Archive tokens"
```

---

## Task 10: Restyle `ListDetailScreen.tsx`

Adds the "Sort by Rating" toggle and swaps the inline "Delete this list" link for a header action opening `CatalogActionsSheet` — both from the spec's "easy wins." `load()`'s query logic, `confirmDeleteList()`, and every other handler are otherwise unchanged.

**Files:**
- Modify: `src/screens/ListDetailScreen.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useCallback, useLayoutEffect, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogItem } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { CatalogActionsSheet } from '../components/CatalogActionsSheet';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [sortByRating, setSortByRating] = useState(true);
  const [actionsVisible, setActionsVisible] = useState(false);
  const ratingField = list.fields.find((f) => f.type === 'rating');

  const load = useCallback(() => {
    if (!user) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    repo
      .getItems(list.id, {
        searchText: search || undefined,
        sortByRatingKey: sortByRating ? ratingField?.key : undefined,
        sortDirection: 'desc',
      })
      .then(setItems);
  }, [user, search, list.id, ratingField, sortByRating]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setActionsVisible(true)}
          accessibilityLabel="Catalog actions"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-vert" size={24} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  function confirmDeleteList() {
    if (!user) return;
    Alert.alert('Delete list?', `This removes "${list.name}" and all its items permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const repo = new FirebaseCatalogRepository(user.uid);
            await repo.deleteList(list.id);
            navigation.navigate('Home');
          } catch (error) {
            Alert.alert('Could not delete list', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-5 pt-4 flex-row items-center gap-3">
        <TextInput
          className="flex-1 bg-surface-container-low rounded-lg p-4 font-body-md text-body-md text-on-surface"
          placeholder="Search"
          placeholderClassName="text-surface-dim"
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            load();
          }}
        />
        {ratingField && (
          <Pressable
            onPress={() => setSortByRating((prev) => !prev)}
            className={`px-3 py-3 rounded-lg border border-outline-variant/40 ${
              sortByRating ? 'bg-primary' : 'bg-surface-container'
            }`}
            accessibilityLabel="Sort by rating"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="star"
              size={16}
              color={sortByRating ? '#ffffff' : theme.colors.onSurfaceVariant}
            />
          </Pressable>
        )}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerClassName="px-5 pt-4 pb-24"
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemForm', { list, item })}
          />
        )}
      />
      <Pressable
        onPress={() => navigation.navigate('ItemForm', { list })}
        className="absolute right-5 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        accessibilityLabel="Add item"
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </Pressable>
      <CatalogActionsSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        onDelete={() => {
          setActionsVisible(false);
          confirmDeleteList();
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `ListDetailScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ListDetailScreen.tsx
git commit -m "feat: restyle ListDetailScreen, add sort-by-rating toggle and actions sheet"
```

---

## Task 11: Restyle `SignInScreen.tsx`

Stitch's mockup includes a decorative hero photo with no licensed asset available — omitted per the spec ("centered layout: wordmark, tagline, single Google button", no image requirement).

**Files:**
- Modify: `src/screens/SignInScreen.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text, View, Pressable } from 'react-native';
import { useAuth } from '../services/auth';

export function SignInScreen() {
  const { signIn, canSignIn } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-5 gap-8">
      <View className="items-center gap-4">
        <Text className="font-display-lg text-display-lg-mobile text-primary">Catalogify</Text>
        <Text className="font-body-md text-body-md text-on-surface-variant italic text-center opacity-80">
          Curate your world, one heirloom at a time.
        </Text>
      </View>
      <Pressable
        onPress={signIn}
        disabled={!canSignIn}
        className={`w-full flex-row items-center justify-center gap-3 bg-primary rounded-lg py-4 ${
          !canSignIn ? 'opacity-50' : ''
        }`}
      >
        <Text className="font-label-md text-label-md text-white">Sign in with Google</Text>
      </Pressable>
      <Text className="font-label-sm text-label-sm text-on-surface-variant opacity-50 uppercase tracking-widest absolute bottom-12">
        A digital heirloom platform
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `SignInScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignInScreen.tsx
git commit -m "style: restyle SignInScreen with Warm Archive tokens"
```

---

## Task 12: Restyle `ItemFormScreen.tsx`

Every handler (`setValue`, `pickPhoto`, `save`, `remove`) and all validation logic is unchanged — only the render layer.

**Files:**
- Modify: `src/screens/ItemFormScreen.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, Image, Switch, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldValue } from '../domain/types';
import { validateItem, hasErrors, ValidationErrors } from '../domain/validation';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemForm'>;

export function ItemFormScreen({ route, navigation }: Props) {
  const { list, item } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState(item?.title ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(item?.values ?? {});
  const [photoUri, setPhotoUri] = useState<string | undefined>(item?.photoUrl);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);

  function setValue(key: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function save() {
    const fieldErrors = validateItem(list, title, values);
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors) || !user) return;

    setSaving(true);
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      const photoChanged = photoUri && photoUri !== item?.photoUrl && !photoUri.startsWith('https://');
      const photoToUpload = photoChanged ? photoUri : undefined;
      if (item) {
        await repo.updateItem(list.id, item.id, title, values, photoToUpload);
      } else {
        await repo.addItem(list.id, title, values, photoToUpload);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save item', error);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !user) return;
    Alert.alert('Delete item?', `This removes "${item.title}" permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const repo = new FirebaseCatalogRepository(user.uid);
            await repo.deleteItem(list.id, item.id);
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete item', error);
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-5 gap-8 pb-16">
      <View className="gap-2">
        <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
          Item Title
        </Text>
        <TextInput
          className="border-b-2 border-surface-dim font-headline-sm text-headline-sm text-on-surface py-3"
          placeholder="Enter name..."
          placeholderClassName="text-surface-dim"
          value={title}
          onChangeText={setTitle}
        />
        {errors.title ? <Text className="text-error text-xs">{errors.title}</Text> : null}
      </View>

      {list.fields.some((f) => f.type === 'photo') && (
        <View className="gap-2">
          <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
            Gallery Image
          </Text>
          <Pressable onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} className="w-full aspect-square rounded-xl" resizeMode="cover" />
            ) : (
              <View className="w-full aspect-square rounded-xl border-2 border-dashed border-surface-dim bg-surface-container-low items-center justify-center">
                <Text className="font-label-md text-label-md text-on-surface-variant">Tap to add photo</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {list.fields
        .filter((f) => f.type !== 'photo')
        .map((field) => (
          <View key={field.key} className="gap-2">
            <Text className="font-label-md text-label-sm uppercase tracking-widest text-on-surface-variant">
              {field.label}
            </Text>

            {(field.type === 'shortText' || field.type === 'number' || field.type === 'date') && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface"
                placeholderClassName="text-surface-dim"
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) =>
                  setValue(field.key, field.type === 'number' ? Number(text) || 0 : text)
                }
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {field.type === 'longText' && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface min-h-[80px]"
                placeholderClassName="text-surface-dim"
                multiline
                textAlignVertical="top"
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, text)}
              />
            )}

            {field.type === 'rating' && (
              <TextInput
                className="bg-surface-container-low border border-surface-dim rounded-lg p-4 font-body-md text-body-md text-on-surface"
                placeholderClassName="text-surface-dim"
                keyboardType="numeric"
                placeholder={`0-${field.ratingScale?.max ?? 10}`}
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, Number(text) || 0)}
              />
            )}

            {field.type === 'boolean' && (
              <Switch
                value={Boolean(values[field.key])}
                onValueChange={(v) => setValue(field.key, v)}
                trackColor={{ true: theme.colors.primary }}
              />
            )}

            {errors[field.key] ? <Text className="text-error text-xs">{errors[field.key]}</Text> : null}
          </View>
        ))}

      <Pressable
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>

      {item && (
        <Pressable onPress={remove}>
          <Text className="text-error text-center">Delete item</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no failures referencing `ItemFormScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ItemFormScreen.tsx
git commit -m "style: restyle ItemFormScreen with Warm Archive tokens"
```

---

## Task 13: Restyle `EditListFieldsScreen.tsx`

Icon-tile field-type picker replacing text chips, per the spec. `addField`/`updateField`/`removeField`/`save` are unchanged. The mockup's "Theme Color" / "Default View" sections are not included (no backing fields on `CatalogList`).

**Files:**
- Modify: `src/screens/EditListFieldsScreen.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Alert } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef, FieldType } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListFields'>;

const FIELD_TYPES: FieldType[] = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];

const FIELD_TYPE_ICONS: Record<FieldType, { name: string; family: 'material' | 'community' }> = {
  shortText: { name: 'short-text', family: 'material' },
  longText: { name: 'notes', family: 'material' },
  number: { name: 'numeric', family: 'community' },
  rating: { name: 'star', family: 'material' },
  photo: { name: 'photo-camera', family: 'material' },
  boolean: { name: 'toggle-on', family: 'material' },
  date: { name: 'event', family: 'material' },
};

function FieldTypeIcon({ type, active }: { type: FieldType; active: boolean }) {
  const { name, family } = FIELD_TYPE_ICONS[type];
  const color = active ? '#ffffff' : theme.colors.onSurfaceVariant;
  return family === 'material' ? (
    <MaterialIcons name={name as any} size={18} color={color} />
  ) : (
    <MaterialCommunityIcons name={name as any} size={18} color={color} />
  );
}

export function EditListFieldsScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const existing = route.params?.list;
  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? []);
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      if (existing) {
        await repo.updateListFields(existing.id, fields);
      } else {
        await repo.createList(name.trim(), fields);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save list', error);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background p-5">
      <TextInput
        className="bg-surface-container-low rounded-lg p-4 mb-4 font-body-md text-body-md text-on-surface"
        placeholder="List name (e.g. Coffees)"
        placeholderClassName="text-surface-dim"
        value={name}
        onChangeText={setName}
        editable={!existing}
      />
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerClassName="gap-4 pb-6"
        renderItem={({ item, index }) => (
          <View className="bg-surface-container-low rounded-lg p-4 gap-3">
            <TextInput
              className="font-label-md text-label-md text-on-surface border-b border-outline-variant/40 pb-1"
              placeholder="Field label"
              placeholderClassName="text-surface-dim"
              value={item.label}
              onChangeText={(label) => updateField(index, { label })}
            />
            <View className="flex-row flex-wrap gap-2">
              {FIELD_TYPES.map((type) => {
                const active = item.type === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => updateField(index, { type })}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/40 ${
                      active ? 'bg-primary' : 'bg-surface-container'
                    }`}
                  >
                    <FieldTypeIcon type={type} active={active} />
                    <Text
                      className={`font-label-sm text-label-sm ${
                        active ? 'text-white' : 'text-on-surface-variant'
                      }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => removeField(index)}>
              <Text className="font-label-sm text-label-sm text-error">Remove field</Text>
            </Pressable>
          </View>
        )}
      />
      <Pressable className="py-4 items-center" onPress={addField}>
        <Text className="font-label-md text-label-md text-primary">+ Add field</Text>
      </Pressable>
      <Pressable
        className={`bg-primary rounded-lg py-4 items-center ${saving ? 'opacity-60' : ''}`}
        onPress={save}
        disabled={saving}
      >
        <Text className="text-white text-base">{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck — this should now be clean project-wide**

Run:
```bash
npx tsc --noEmit
```
Expected: exits 0 with **no** errors anywhere. Every file that referenced the old `theme.ts` shape has now been migrated (Tasks 6–13); this is the first point since Task 4 where the full project typechecks.

- [ ] **Step 3: Commit**

```bash
git add src/screens/EditListFieldsScreen.tsx
git commit -m "style: restyle EditListFieldsScreen with icon field-type picker"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
pnpm test
npx tsc --noEmit
npx expo export --platform web --output-dir /private/tmp/claude-502/-Users-work-personal-random/fdeece4c-0ce6-424b-aba5-a29b677bc34d/scratchpad/catalogify-export-check-final
```
Expected: all three exit 0. `pnpm test` covers `validation.test.ts`, `FirebaseCatalogRepository.test.ts`, `image.test.ts`, and the new `StarRating.test.ts` — none of the business-logic tests should have changed behavior, since no task touched `src/domain/` or `src/services/`.

- [ ] **Step 2: Manual visual check (requires your go-ahead to start a simulator/dev server)**

This step needs explicit permission before starting a packager or simulator, per the project's own `stitch-react-native` skill rules. Ask before running:
```bash
npx expo start
```
Then open each of the 5 screens and compare against its corresponding screenshot in `.stitch/designs/*.png` (`sign_in.png`, `home.png`, `list_detail.png`, `add_edit_item.png`, `list_builder.png`) plus `catalog_actions_modal.png` for the sheet. Check specifically:
- Playfair Display renders on headings (not falling back to system serif — a sign the font failed to load)
- Warm Archive palette (cream background, terracotta primary, no leftover old theme colors)
- `ListDetailScreen`'s sort-by-rating toggle actually re-sorts the item list
- `CatalogActionsSheet` opens from the header "⋮" button and its Delete action still shows the existing confirm `Alert` before deleting

- [ ] **Step 3: No commit for this task** — it's verification only. If Step 2 surfaces a visual defect, fix it in the relevant screen's file and commit that fix separately (not part of this plan's task list, since the exact defect is unknown ahead of time).

---

## Plan self-review

**Spec coverage:**
- Scope (5 screens + 2 components) → Tasks 5–13. ✓
- Sort by Rating toggle → Task 10. ✓
- CatalogActionsSheet, Delete-only → Task 6, wired in Task 10. ✓
- Icon field-type picker, no Theme Color/Default View → Task 13. ✓
- Tonal-block list tiles → Task 7. ✓
- Warm Archive tokens, radius drift normalized to 4px → Task 1 Step 6. ✓
- NativeWind v4 primary path → Task 1. (The spec's v5-preview fallback is not a task here — if Task 1 Step 10's verification fails because of a genuine v4/RN-0.86 incompatibility, that's a stop-and-replan situation, not a scripted fallback task, since the exact failure mode can't be known in advance.)
- theme.ts thin module → Task 4 (and completed by Task 13). ✓
- `.stitch/designs/` copy → Task 3. ✓
- No domain/service/navigation changes → verified structurally (no task touches those paths) and confirmed by Task 14's unchanged test suite. ✓

**Placeholder scan:** no TBD/TODO; every step has complete code or an exact command with expected output.

**Type consistency:** `CatalogActionsSheet` props (`visible`, `onClose`, `onDelete`) match its usage in `ListDetailScreen` (Task 10). `StarRating` props (`rating`, `max`, `size`) match its usage in `ItemCard` (Task 8). `theme.colors.{primary,onSurfaceVariant,outline,danger}` (Task 4) match every consumption site in Tasks 6, 9, 10, 12, 13 — no other `theme.colors.*` key is referenced anywhere in the plan.
