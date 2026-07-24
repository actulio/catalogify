# Localization (PT/EN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize Catalogify's UI into Portuguese (default) and English, auto-detecting the device locale on first launch with a persisted manual override in a new Settings screen.

**Architecture:** `i18next` + `react-i18next` with one translation file per language (`pt.json`/`en.json`), nested by screen area (`common`, `signIn`, `home`, `listDetail`, `itemForm`, `itemDetail`, `editFields`, `settings`, `filterSort`). A pure `resolveInitialLanguage()` reads the persisted choice (AsyncStorage) else maps the device locale (`expo-localization`) to `pt`/`en`. `App.tsx` awaits i18n init behind an `i18nReady` gate. Language switching calls `i18n.changeLanguage()` (instant re-render, no reload) and persists the choice.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, i18next, react-i18next, expo-localization, @react-native-async-storage/async-storage (already installed), jest-expo.

**Reference:** expo-localization v57 API — `getLocales()` is synchronous and returns `Array<{ languageCode: string | null, ... }>`. Verify at https://docs.expo.dev/versions/v57.0.0/sdk/localization/ (per AGENTS.md).

**Scope guardrails:** UI strings only (no date/number formatting changes); exactly two locales; user-generated content (catalog names, field labels, item values) is never translated.

**Branch:** `feat/localization` (already checked out; spec committed).

**Verify commands:** `npx tsc --noEmit` and `npm test` (runs the jest `app` project). Existing baseline: tsc 0, 7 suites / 54 tests.

---

## File Structure

**Create:**
- `src/i18n/config.ts` — constants: `LANGUAGE_STORAGE_KEY`, `SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `Language` type.
- `src/i18n/locales/pt.json` — Portuguese strings (source of truth).
- `src/i18n/locales/en.json` — English strings (mirrors pt key set).
- `src/i18n/locales.test.ts` — key-parity test (pt vs en).
- `src/i18n/detectLanguage.ts` — `resolveInitialLanguage(): Promise<Language>`.
- `src/i18n/detectLanguage.test.ts` — resolution-logic test.
- `src/i18n/index.ts` — i18next instance, `initI18n()`, `setLanguage()`, `getLanguage()`.
- `src/screens/SettingsScreen.tsx` — language picker.

**Modify:**
- `App.tsx` — import i18n init, gate render on `i18nReady`.
- `src/navigation/RootNavigator.tsx` — add `Settings` route.
- `src/screens/HomeScreen.tsx` — gear icon in header → navigate to Settings; migrate strings.
- `src/screens/SignInScreen.tsx`, `ListDetailScreen.tsx`, `ItemFormScreen.tsx`, `ItemDetailScreen.tsx`, `EditListFieldsScreen.tsx` — migrate strings.
- `src/components/CatalogStats.tsx`, `ListTile.tsx`, `FilterSortSheet.tsx`, `CatalogActionsSheet.tsx` — migrate strings.

**Naming convention for translation keys:** `area.key` (dot-nested inside the JSON, one top-level object per area). Plurals use i18next suffixes `key_one`/`key_other` with `{{count}}`. Interpolation uses `{{name}}`. Every key added to `pt.json` MUST also be added to `en.json` (the parity test enforces this).

---

## Task 1: Install dependencies

**Files:** none (package changes only).

- [ ] **Step 1: Install the three packages**

Run (uses `expo install` so versions match SDK 57):

```bash
cd /Users/work/personal/random/catalogify
npx expo install expo-localization
npm install i18next react-i18next
```

- [ ] **Step 2: Verify installs**

Run: `node -e "const p=require('./package.json').dependencies; console.log(p['expo-localization'], p.i18next, p['react-i18next'])"`
Expected: three version strings printed (no `undefined`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(i18n): add i18next, react-i18next, expo-localization"
```

> **Note (on-device):** expo-localization is a native module — the dev client MUST be rebuilt before on-device testing (JS reload will not pick it up). This is the user's step, flagged in Task 12.

---

## Task 2: i18n config constants

**Files:**
- Create: `src/i18n/config.ts`

- [ ] **Step 1: Write the config module**

```ts
// src/i18n/config.ts
export const SUPPORTED_LANGUAGES = ['pt', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'pt';
export const LANGUAGE_STORAGE_KEY = '@catalogify/lang';

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/config.ts
git commit -m "feat(i18n): add language config constants"
```

---

## Task 3: Locale files + key-parity test (TDD)

**Files:**
- Create: `src/i18n/locales/pt.json`, `src/i18n/locales/en.json`
- Test: `src/i18n/locales.test.ts`

- [ ] **Step 1: Write the failing parity test**

```ts
// src/i18n/locales.test.ts
import pt from './locales/pt.json';
import en from './locales/en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? flattenKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('locale key parity', () => {
  it('pt and en have identical key sets', () => {
    const ptKeys = flattenKeys(pt).sort();
    const enKeys = flattenKeys(en).sort();
    const onlyPt = ptKeys.filter((k) => !enKeys.includes(k));
    const onlyEn = enKeys.filter((k) => !ptKeys.includes(k));
    expect({ onlyPt, onlyEn }).toEqual({ onlyPt: [], onlyEn: [] });
  });
});
```

- [ ] **Step 2: Create the initial locale files (full app key set)**

Create `src/i18n/locales/pt.json`:

```json
{
  "common": {
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "couldNotSave": "Não foi possível salvar",
    "couldNotSaveBody": "Tente novamente.",
    "couldNotDelete": "Não foi possível excluir",
    "couldNotDeleteBody": "Tente novamente.",
    "yes": "Sim",
    "no": "Não",
    "item_one": "{{count}} item",
    "item_other": "{{count}} itens"
  },
  "signIn": {
    "signInWithGoogle": "Entrar com Google"
  },
  "home": {
    "searchPlaceholder": "Buscar catálogos",
    "newCatalog": "Novo Catálogo",
    "openSettings": "Configurações"
  },
  "settings": {
    "title": "Configurações",
    "languageSection": "Idioma",
    "languagePortuguese": "Português",
    "languageEnglish": "English"
  },
  "listDetail": {
    "searchPlaceholder": "Buscar",
    "filterSort": "Filtrar e ordenar",
    "catalogActions": "Ações do catálogo",
    "addItem": "Adicionar item",
    "toggleStats": "Alternar estatísticas do catálogo",
    "deleteListTitle": "Excluir lista?",
    "deleteListMessage": "Isso remove \"{{name}}\" e todos os seus itens permanentemente.",
    "couldNotDeleteList": "Não foi possível excluir a lista",
    "emptyTitle": "Este catálogo está vazio",
    "emptyBody": "Toque em + para adicionar seu primeiro item.",
    "noMatchesTitle": "Nenhum resultado",
    "noMatchesBody": "Tente ajustar sua busca ou filtros."
  },
  "itemForm": {
    "namePlaceholder": "Digite o nome...",
    "pickDate": "Toque para escolher uma data",
    "deleteItem": "Excluir item"
  },
  "itemDetail": {
    "fallbackTitle": "Item",
    "editItem": "Editar item",
    "deleteItem": "Excluir item",
    "deleteItemTitle": "Excluir item?",
    "deleteItemMessage": "Isso remove \"{{title}}\" permanentemente."
  },
  "editFields": {
    "namePlaceholder": "Nome do Catálogo",
    "nameHelp": "Dê um nome ao seu catálogo. É o que você verá na tela inicial.",
    "coverHelp": "Opcional. Exibido atrás do nome do catálogo na tela inicial.",
    "fieldsHelp": "Escolha quais detalhes cada item deste catálogo terá.",
    "fieldLabelPlaceholder": "Nome do campo"
  },
  "catalogActions": {
    "close": "Fechar ações do catálogo",
    "edit": "Editar catálogo",
    "delete": "Excluir catálogo"
  },
  "filterSort": {
    "sortDateAdded": "Data de adição",
    "sortTitle": "Título",
    "any": "Qualquer",
    "yes": "Sim",
    "no": "Não",
    "from": "De",
    "to": "Até"
  }
}
```

Create `src/i18n/locales/en.json` (same keys, English values):

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "couldNotSave": "Could not save",
    "couldNotSaveBody": "Please try again.",
    "couldNotDelete": "Could not delete",
    "couldNotDeleteBody": "Please try again.",
    "yes": "Yes",
    "no": "No",
    "item_one": "{{count}} item",
    "item_other": "{{count}} items"
  },
  "signIn": {
    "signInWithGoogle": "Sign in with Google"
  },
  "home": {
    "searchPlaceholder": "Search catalogs",
    "newCatalog": "New Catalog",
    "openSettings": "Settings"
  },
  "settings": {
    "title": "Settings",
    "languageSection": "Language",
    "languagePortuguese": "Português",
    "languageEnglish": "English"
  },
  "listDetail": {
    "searchPlaceholder": "Search",
    "filterSort": "Filter and sort",
    "catalogActions": "Catalog actions",
    "addItem": "Add item",
    "toggleStats": "Toggle catalog stats",
    "deleteListTitle": "Delete list?",
    "deleteListMessage": "This removes \"{{name}}\" and all its items permanently.",
    "couldNotDeleteList": "Could not delete list",
    "emptyTitle": "This catalog is empty",
    "emptyBody": "Tap + to add your first item.",
    "noMatchesTitle": "No matches",
    "noMatchesBody": "Try adjusting your search or filters."
  },
  "itemForm": {
    "namePlaceholder": "Enter name...",
    "pickDate": "Tap to pick a date",
    "deleteItem": "Delete item"
  },
  "itemDetail": {
    "fallbackTitle": "Item",
    "editItem": "Edit item",
    "deleteItem": "Delete item",
    "deleteItemTitle": "Delete item?",
    "deleteItemMessage": "This removes \"{{title}}\" permanently."
  },
  "editFields": {
    "namePlaceholder": "Catalog Name",
    "nameHelp": "Give your catalog a name. This is what you'll see on the home screen.",
    "coverHelp": "Optional. Shown behind the catalog name on the home screen.",
    "fieldsHelp": "Choose what details each item in this catalog will have.",
    "fieldLabelPlaceholder": "Field label"
  },
  "catalogActions": {
    "close": "Close catalog actions",
    "edit": "Edit Catalog",
    "delete": "Delete Catalog"
  },
  "filterSort": {
    "sortDateAdded": "Date added",
    "sortTitle": "Title",
    "any": "Any",
    "yes": "Yes",
    "no": "No",
    "from": "From",
    "to": "To"
  }
}
```

- [ ] **Step 3: Enable JSON module resolution if needed**

Run: `node -e "const t=require('./tsconfig.json'); console.log(JSON.stringify(t.compilerOptions||{}))"`
If `resolveJsonModule` is not already `true` (jest-expo/expo base tsconfig usually enables it), add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.json`.

- [ ] **Step 4: Run parity test**

Run: `npm test -- src/i18n/locales.test.ts`
Expected: PASS (both files were authored with identical keys).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/pt.json src/i18n/locales/en.json src/i18n/locales.test.ts tsconfig.json
git commit -m "feat(i18n): add pt/en locale files with key-parity test"
```

---

## Task 4: Language resolution (TDD)

**Files:**
- Create: `src/i18n/detectLanguage.ts`
- Test: `src/i18n/detectLanguage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/i18n/detectLanguage.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { resolveInitialLanguage } from './detectLanguage';
import { LANGUAGE_STORAGE_KEY } from './config';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetLocales = Localization.getLocales as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
});

describe('resolveInitialLanguage', () => {
  it('uses a stored supported language when present', async () => {
    mockGetItem.mockResolvedValue('en');
    mockGetLocales.mockReturnValue([{ languageCode: 'pt' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('en');
    expect(mockGetLocales).not.toHaveBeenCalled();
  });

  it('maps a Portuguese device locale to pt and persists it', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'pt' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('pt');
    expect(mockSetItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'pt');
  });

  it('falls back to en for a non-Portuguese device locale', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('en');
    expect(mockSetItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'en');
  });

  it('ignores an invalid stored value and re-resolves from locale', async () => {
    mockGetItem.mockResolvedValue('zz');
    mockGetLocales.mockReturnValue([{ languageCode: 'pt-BR' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('pt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/i18n/detectLanguage.test.ts`
Expected: FAIL ("Cannot find module './detectLanguage'").

- [ ] **Step 3: Write the implementation**

```ts
// src/i18n/detectLanguage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, Language, isSupportedLanguage } from './config';

function mapDeviceLocale(): Language {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? '';
  return code.startsWith('pt') ? 'pt' : 'en';
}

// Stored choice wins; otherwise map the device locale (pt* -> pt, else en) and
// persist it so the resolved default is stable across launches.
export async function resolveInitialLanguage(): Promise<Language> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;

  const resolved = mapDeviceLocale();
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
  } catch {
    // Persistence is best-effort; fall through with the resolved value.
  }
  return resolved ?? DEFAULT_LANGUAGE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/i18n/detectLanguage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/detectLanguage.ts src/i18n/detectLanguage.test.ts
git commit -m "feat(i18n): resolve initial language from storage or device locale"
```

---

## Task 5: i18next instance + init + switch

**Files:**
- Create: `src/i18n/index.ts`

- [ ] **Step 1: Write the i18n module**

```ts
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, Language } from './config';
import { resolveInitialLanguage } from './detectLanguage';
import pt from './locales/pt.json';
import en from './locales/en.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const resources = {
  pt: { translation: pt },
  en: { translation: en },
} as const;

// Initialize i18next once, with the resolved startup language. Returns the
// i18n instance so App can render it via I18nextProvider.
export async function initI18n(): Promise<typeof i18n> {
  const lng = await resolveInitialLanguage();
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false }, // RN doesn't need HTML escaping
      returnNull: false,
    });
  } else {
    await i18n.changeLanguage(lng);
  }
  return i18n;
}

export function getLanguage(): Language {
  return (i18n.language as Language) ?? DEFAULT_LANGUAGE;
}

// Switch language at runtime: re-renders all useTranslation consumers instantly
// (no reload) and persists the choice.
export async function setLanguage(lng: Language): Promise<void> {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
}

export default i18n;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/index.ts
git commit -m "feat(i18n): add i18next instance with init and setLanguage"
```

---

## Task 6: Wire i18n into App.tsx (ready gate)

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the i18n init + ready gate**

Modify `App.tsx`:
1. Add imports near the top (after the existing `import './src/theme/nativewind-setup';`):

```tsx
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from './src/i18n';
```

(Merge `useState` into the existing `import { useEffect } from 'react';` line so it becomes `import { useEffect, useState } from 'react';`.)

2. Inside `App`, add ready state and init effect (alongside the existing `useEffect`):

```tsx
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);
```

3. Extend the early-return gate — change `if (!loaded) return null;` to:

```tsx
  if (!loaded || !i18nReady) return null;
```

4. Wrap the returned tree in `I18nextProvider` (outermost, around `KeyboardProvider`):

```tsx
  return (
    <I18nextProvider i18n={i18n}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </KeyboardProvider>
    </I18nextProvider>
  );
```

- [ ] **Step 2: Typecheck + full test suite (no regressions)**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all suites pass (existing 54 + parity + 4 detect = 59 tests across 9 suites).

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(i18n): initialize i18n in App behind a ready gate"
```

---

## Task 7: Settings screen + route + Home gear icon

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`, `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Create SettingsScreen**

```tsx
// src/screens/SettingsScreen.tsx
import { useLayoutEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, Language } from '../i18n/config';
import { setLanguage } from '../i18n';
import { theme } from '../theme/theme';

const LABEL_KEY: Record<Language, string> = {
  pt: 'settings.languagePortuguese',
  en: 'settings.languageEnglish',
};

export function SettingsScreen() {
  // Read the current language reactively via the hook so the check mark updates
  // instantly when setLanguage() calls i18n.changeLanguage().
  const { t, i18n } = useTranslation();
  const current = i18n.language as Language;
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('settings.title') });
  }, [navigation, t]);

  return (
    <View className="flex-1 bg-background">
      <Text className="px-5 pt-5 pb-2 font-label-md text-label-md text-secondary uppercase tracking-widest">
        {t('settings.languageSection')}
      </Text>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = lng === current;
        return (
          <Pressable
            key={lng}
            onPress={() => void setLanguage(lng)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="flex-row items-center justify-between px-5 py-4 border-b border-outline-variant/30"
          >
            <Text className="font-body-md text-body-md text-on-surface">{t(LABEL_KEY[lng])}</Text>
            {active && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}
```

The header title is set inside the screen (above) via `useLayoutEffect`, keeping `RootNavigator` free of i18n.

- [ ] **Step 2: Add the Settings route**

Modify `src/navigation/RootNavigator.tsx`:
1. Add to `RootStackParamList` (after `ItemDetail`): `Settings: undefined;`
2. Import: `import { SettingsScreen } from '../screens/SettingsScreen';`
3. Add inside the authed `<>...</>` block (after the ItemDetail screen):

```tsx
            <Stack.Screen name="Settings" component={SettingsScreen} />
```

The screen sets its own localized header title via `useLayoutEffect` (Task 7 Step 1), so `RootNavigator` needs no `t` and no per-screen `options`.

- [ ] **Step 3: Add the gear icon to the Home header**

Modify `src/screens/HomeScreen.tsx`:
1. Add imports: `useLayoutEffect` (merge into the `react` import), and `useTranslation` from `'react-i18next'`.
2. Inside `HomeScreen`, add:

```tsx
  const { t } = useTranslation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel={t('home.openSettings')}
          accessibilityRole="button"
        >
          <MaterialIcons name="settings" size={22} color={theme.colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, t]);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/navigation/RootNavigator.tsx src/screens/HomeScreen.tsx
git commit -m "feat(settings): add Settings screen with language picker and Home entry"
```

---

## Task 8: Migrate Home + SignIn strings

**Files:**
- Modify: `src/screens/HomeScreen.tsx`, `src/screens/SignInScreen.tsx`

- [ ] **Step 1: HomeScreen strings**

In `src/screens/HomeScreen.tsx` (already has `t` from Task 7):
- `placeholder="Search catalogs"` → `placeholder={t('home.searchPlaceholder')}`
- `New Catalog` text → `{t('home.newCatalog')}`

Leave the brand wordmark (`Catalogify`) hardcoded — it is a proper noun, not translated.

- [ ] **Step 2: SignInScreen strings**

In `src/screens/SignInScreen.tsx`:
- Add `import { useTranslation } from 'react-i18next';` and `const { t } = useTranslation();` in the component.
- `Sign in with Google` text → `{t('signIn.signInWithGoogle')}`.
- Leave the `Catalogify` wordmark hardcoded.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/SignInScreen.tsx
git commit -m "feat(i18n): localize Home and SignIn strings"
```

---

## Task 9: Migrate ListDetail + its components (stats, filter, actions, tile)

**Files:**
- Modify: `src/screens/ListDetailScreen.tsx`, `src/components/CatalogStats.tsx`, `src/components/ListTile.tsx`, `src/components/FilterSortSheet.tsx`, `src/components/CatalogActionsSheet.tsx`

- [ ] **Step 1: ListDetailScreen strings**

Add `import { useTranslation } from 'react-i18next';` + `const { t } = useTranslation();`. Replace:
- `placeholder="Search"` → `placeholder={t('listDetail.searchPlaceholder')}`
- `accessibilityLabel="Filter and sort"` → `t('listDetail.filterSort')`
- `accessibilityLabel="Catalog actions"` → `t('listDetail.catalogActions')`
- `accessibilityLabel="Add item"` → `t('listDetail.addItem')`
- `'Delete list?'` → `t('listDetail.deleteListTitle')`
- delete message `` `This removes "${list.name}" and all its items permanently.` `` → `t('listDetail.deleteListMessage', { name: list.name })`
- `'Could not delete list'` → `t('listDetail.couldNotDeleteList')` and its body `'Please try again.'` → `t('common.couldNotDeleteBody')`
- empty/no-match titles/bodies → `t('listDetail.emptyTitle' | 'noMatchesTitle' | 'emptyBody' | 'noMatchesBody')` matching the existing ternaries.

- [ ] **Step 2: Plural counts in CatalogStats + ListTile**

In `src/components/CatalogStats.tsx`: add `useTranslation`; replace `{stats.total} {stats.total === 1 ? 'item' : 'items'}` with `{t('common.item', { count: stats.total })}`. Replace `accessibilityLabel="Toggle catalog stats"` → `t('listDetail.toggleStats')`. Read the full file and localize any remaining stat labels; add keys under a new `stats` object in BOTH json files if any exist (follow the naming convention; the parity test guards you).

In `src/components/ListTile.tsx`: add `useTranslation`; replace `{itemCount} {itemCount === 1 ? 'item' : 'items'}` with `{t('common.item', { count: itemCount })}`.

- [ ] **Step 3: FilterSortSheet + CatalogActionsSheet strings**

In `src/components/FilterSortSheet.tsx`: add `useTranslation`; localize the sort option labels (`'Date added'`→`filterSort.sortDateAdded`, `'Title'`→`filterSort.sortTitle`), tri-state labels (`'Any'`/`'Yes'`/`'No'`→`filterSort.any/yes/no`), and `'From'`/`'To'` (→`filterSort.from/to`). Read the full file and localize any remaining section headers; add keys under `filterSort` in BOTH json files. Leave `new Date(...).toLocaleDateString(...)` untouched (date formatting is out of scope).

In `src/components/CatalogActionsSheet.tsx`: add `useTranslation`; localize `accessibilityLabel` values (`'Close catalog actions'`, `'Edit Catalog'`, `'Delete Catalog'`, `'Cancel'`) → `catalogActions.close/edit/delete` and `common.cancel`, plus any visible button text under `catalogActions` (add keys in BOTH json files).

- [ ] **Step 4: Typecheck + full tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all pass (parity test still green — any new keys were added to both files).

- [ ] **Step 5: Commit**

```bash
git add src/screens/ListDetailScreen.tsx src/components/CatalogStats.tsx src/components/ListTile.tsx src/components/FilterSortSheet.tsx src/components/CatalogActionsSheet.tsx src/i18n/locales/pt.json src/i18n/locales/en.json
git commit -m "feat(i18n): localize ListDetail and its components"
```

---

## Task 10: Migrate ItemForm + ItemDetail + EditListFields

**Files:**
- Modify: `src/screens/ItemFormScreen.tsx`, `src/screens/ItemDetailScreen.tsx`, `src/screens/EditListFieldsScreen.tsx`

- [ ] **Step 1: ItemFormScreen**

Add `useTranslation`. Replace:
- `'Could not save'` → `t('common.couldNotSave')`; body `'Please try again.'` → `t('common.couldNotSaveBody')`.
- `'Delete item?'` → `t('itemDetail.deleteItemTitle')`; message `` `This removes "${item.title}" permanently.` `` → `t('itemDetail.deleteItemMessage', { title: item.title })`.
- `'Could not delete'` → `t('common.couldNotDelete')`; body → `t('common.couldNotDeleteBody')`.
- `placeholder="Enter name..."` → `t('itemForm.namePlaceholder')`.
- `'Tap to pick a date'` → `t('itemForm.pickDate')`.
- Any "Delete item" button text → `t('itemForm.deleteItem')`. Leave the numeric rating placeholder `` `0-${...}` `` as-is (not translatable copy). Read the full file and localize any remaining `Alert`/label/button/`Text` strings; add keys under `itemForm` in BOTH json files.

- [ ] **Step 2: ItemDetailScreen**

Add `useTranslation`. Replace:
- header `title: item.title || 'Item'` → `item.title || t('itemDetail.fallbackTitle')`
- `accessibilityLabel="Edit item"` → `t('itemDetail.editItem')`
- `'Delete item?'` → `t('itemDetail.deleteItemTitle')`; message → `t('itemDetail.deleteItemMessage', { title: item.title })`
- `'Could not delete'` → `t('common.couldNotDelete')`; body → `t('common.couldNotDeleteBody')`
- `'Delete item'` text → `t('itemDetail.deleteItem')`
- boolean value display `value ? 'Yes' : 'No'` → `value ? t('common.yes') : t('common.no')`. Read the full file and localize any remaining strings; add keys in BOTH json files.

- [ ] **Step 3: EditListFieldsScreen**

Add `useTranslation`. Replace:
- `'Could not save'` → `t('common.couldNotSave')`; body → `t('common.couldNotSaveBody')`.
- `placeholder="Catalog Name"` → `t('editFields.namePlaceholder')`.
- helper texts → `t('editFields.nameHelp' | 'coverHelp' | 'fieldsHelp')` matching the existing copy.
- `placeholder="Field label"` → `t('editFields.fieldLabelPlaceholder')`.
- Read the full file and localize remaining strings: any section headers, the field-type option labels (e.g. Short text / Number / Rating / Date / Boolean / Photo), the "Add field" and "Save" buttons, and the sortable toggle label. Add keys under `editFields` (and reuse `common.save` for Save) in BOTH json files, following the naming convention. The field-type labels map to the app's `FieldDef['type']` values — add one key per type under `editFields.fieldType.*`.

- [ ] **Step 4: Typecheck + full tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all pass (parity green).

- [ ] **Step 5: Commit**

```bash
git add src/screens/ItemFormScreen.tsx src/screens/ItemDetailScreen.tsx src/screens/EditListFieldsScreen.tsx src/i18n/locales/pt.json src/i18n/locales/en.json
git commit -m "feat(i18n): localize ItemForm, ItemDetail and EditListFields"
```

---

## Task 11: Hardcoded-string sweep (completeness gate)

**Files:** none (verification), plus any fixes surfaced.

- [ ] **Step 1: Grep for remaining hardcoded user-facing strings**

Run:

```bash
cd /Users/work/personal/random/catalogify
grep -rnE "placeholder=\"[A-Za-z]|accessibilityLabel=\"[A-Za-z]|Alert\.alert\('|Alert\.alert\(\"" src/screens src/components | grep -v "t('" | grep -v 't("'
```

Expected: no user-facing literals remain (matches should only be dynamic/`t(...)` forms). Investigate every hit; if a real UI string remains, add it to the correct namespace in BOTH json files and replace it with `t(...)`. Re-run until clean.

- [ ] **Step 2: Grep for leftover inline JSX text literals**

Run:

```bash
grep -rnE ">[A-Z][a-z]+ [a-z]" src/screens src/components | grep -vE "font-|text-|className|\{t\(" | head -40
```

Review each: brand names (`Catalogify`) and dynamic values are fine; real copy must be migrated. Fix any misses (add keys to both json files, replace with `t`).

- [ ] **Step 3: Typecheck + full tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 0; all pass.

- [ ] **Step 4: Commit (only if fixes were made)**

```bash
git add -A
git commit -m "feat(i18n): sweep remaining hardcoded strings"
```

---

## Task 12: On-device verification checklist (human)

**Not an automated task** — the user runs the device build. Record outcomes; do not mark complete until confirmed.

- [ ] **Dev-client rebuild** (expo-localization is a native module): `npx expo run:android` (or a fresh dev build). A JS reload will NOT pick it up.
- [ ] First launch on a **Portuguese device** shows Portuguese UI; on a **non-Portuguese device** shows English.
- [ ] **Settings** (gear in Home header) → switch language → all visible screens re-render **immediately**, no reload.
- [ ] The chosen language **survives an app restart** (persisted).
- [ ] Pluralized counts read correctly in both languages: "1 item"/"2 itens" (PT), "1 item"/"2 items" (EN) — check Home tiles and the catalog stats bar.
- [ ] **User content is unchanged** by language: catalog names, field labels, and item values stay exactly as typed.
- [ ] Spot-check every screen (SignIn, Home, ListDetail, ItemForm, ItemDetail, EditListFields, filter/sort sheet, catalog actions sheet) for leftover English when in PT.

---

## Self-Review notes (for the executor)

- **Spec coverage:** engine (i18next, Task 5) · locale detection + persistence (Task 4) · manual override in Settings (Task 7) · UI-strings-only scope (Tasks 8–11; dates left untouched, called out in Task 9 Step 3) · key-parity test (Task 3) · resolution-logic test (Task 4) · dev-client rebuild flagged (Tasks 1 & 12).
- **Plural handling:** only `common.item` is pluralized (the sole count string surfaced, in CatalogStats + ListTile). If other counts surface during migration, add `_one/_other` pairs under `common` in both files.
- **Key parity is the safety net:** every migration task that adds keys touches BOTH json files; `locales.test.ts` fails the build if they diverge — run `npm test` after each migration task.
- **Migration tasks intentionally include a "read the full file" instruction** because a handful of inline strings (stat labels, filter section headers, field-type labels) weren't fully enumerated at plan time; Task 11 is the hard completeness gate that catches any miss.
