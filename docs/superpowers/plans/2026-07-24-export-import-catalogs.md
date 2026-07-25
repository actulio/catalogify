# Export / Import Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a single catalog (data + photos) to a portable `.zip` and import it back — on the same or a different account — always creating a new catalog.

**Architecture:** Pure, unit-tested core (`catalogArchive` zip/unzip+validation, `mapWithConcurrency`, `transferCooldown`) + a thin orchestration layer (`catalogTransfer`) that takes an injectable `TransferIo` boundary so the real Expo file/network I/O is isolated (device-verified) while sequencing is unit-tested with fakes. UI reuses the existing `FirebaseCatalogRepository` (`createList` + `addItem` already resize & upload photos), so import needs zero new upload code.

**Tech Stack:** Expo SDK 57 (`expo-file-system` new `File`/`Paths` API, `expo-sharing`, `expo-document-picker`), `fflate` (pure-JS zip), React Query, i18next, TypeScript, Jest (`jest-expo` `app` project).

---

## Spec reference
`docs/superpowers/specs/2026-07-24-export-import-catalogs-design.md`

## File structure (created / modified)
- Create `src/services/catalogArchive.ts` — pure zip build + parse/validate. Owns the on-disk JSON schema.
- Create `src/services/catalogArchive.test.ts` — round-trip + validation tests.
- Create `src/utils/mapWithConcurrency.ts` — bounded-parallelism async map with cancel.
- Create `src/utils/mapWithConcurrency.test.ts`.
- Create `src/services/transferCooldown.ts` — AsyncStorage-backed shared cooldown.
- Create `src/services/transferCooldown.test.ts`.
- Create `src/services/catalogTransfer.ts` — `TransferIo` interface, `realTransferIo`, `exportCatalog`, `importCatalog`.
- Create `src/services/catalogTransfer.test.ts` — sequencing tests with fakes.
- Create `src/hooks/useCatalogTransfer.ts` — `useCatalogExport(listId)` + `useCatalogImport()` UI state hooks.
- Create `src/components/TransferProgressModal.tsx` — progress + cancel UI.
- Modify `src/components/CatalogActionsSheet.tsx` — add an Export row.
- Modify `src/screens/ListDetailScreen.tsx` — wire export.
- Modify `src/screens/SettingsScreen.tsx` — add a Data section with an Import row.
- Modify `src/i18n/locales/pt.json` and `src/i18n/locales/en.json` — new keys.
- Modify `app.json` — `expo-file-system` config plugin.
- Modify `package.json` — new deps (via installers).

**Verify commands (run after each task):** `npx tsc --noEmit` and `npm test`.

---

### Task 0: Install dependencies + config plugin

**Files:**
- Modify: `package.json` (via installers)
- Modify: `app.json`

- [ ] **Step 1: Install native modules (SDK-57-pinned) and fflate**

Run:
```bash
npx expo install expo-file-system expo-sharing expo-document-picker
npm install fflate
```
Expected: `package.json` gains `expo-file-system` (~57.x), `expo-sharing`, `expo-document-picker`, `fflate`.

- [ ] **Step 2: Add the expo-file-system config plugin (enables iOS file sharing)**

In `app.json`, inside `expo.plugins`, add:
```json
[
  "expo-file-system",
  { "supportsOpeningDocumentsInPlace": true, "enableFileSharing": true }
]
```
(Append to the existing `plugins` array; do not remove existing entries.)

- [ ] **Step 3: Verify typecheck + tests still green**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (no code changes yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: add expo-file-system/sharing/document-picker + fflate for catalog transfer"
```

> ⚠️ These are new native modules → the dev client must be rebuilt before on-device testing (Task 13). The human runs the build.

---

### Task 1: i18n keys

**Files:**
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/en.json`
- Test: `src/i18n/locales.test.ts` (existing key-parity test)

- [ ] **Step 1: Add keys to `pt.json` (source of truth)**

Add a new top-level `"transfer"` block, a `"data"` sub-block under the existing `"settings"`, and an `"export"` key under the existing `"catalogActions"`:
```jsonc
// new top-level block
"transfer": {
  "exportTitle": "Exportar catálogo",
  "importTitle": "Importar catálogo",
  "preparing": "Preparando…",
  "downloading": "Baixando fotos {{done}}/{{total}}",
  "building": "Compactando…",
  "reading": "Lendo arquivo…",
  "finishing": "Finalizando…",
  "cancel": "Cancelar",
  "canceled": "Operação cancelada",
  "exportSuccess": "Catálogo exportado",
  "importSuccess": "Catálogo importado",
  "invalidFile": "Arquivo inválido ou corrompido",
  "unsupportedVersion": "Este arquivo foi criado por uma versão mais recente do app",
  "genericError": "Algo deu errado. Tente novamente.",
  "cooldownRemaining": "Aguarde {{seconds}}s",
  "sharingUnavailable": "Compartilhamento indisponível neste dispositivo"
}
```
Under existing `"settings"` add:
```jsonc
"dataSection": "Dados",
"importCatalog": "Importar catálogo"
```
Under existing `"catalogActions"` add:
```jsonc
"export": "Exportar catálogo"
```

- [ ] **Step 2: Add the SAME keys to `en.json`**

```jsonc
"transfer": {
  "exportTitle": "Export catalog",
  "importTitle": "Import catalog",
  "preparing": "Preparing…",
  "downloading": "Downloading photos {{done}}/{{total}}",
  "building": "Compressing…",
  "reading": "Reading file…",
  "finishing": "Finishing…",
  "cancel": "Cancel",
  "canceled": "Operation canceled",
  "exportSuccess": "Catalog exported",
  "importSuccess": "Catalog imported",
  "invalidFile": "Invalid or corrupted file",
  "unsupportedVersion": "This file was created by a newer version of the app",
  "genericError": "Something went wrong. Please try again.",
  "cooldownRemaining": "Wait {{seconds}}s",
  "sharingUnavailable": "Sharing is not available on this device"
}
```
Under `"settings"`: `"dataSection": "Data"`, `"importCatalog": "Import catalog"`.
Under `"catalogActions"`: `"export": "Export catalog"`.

- [ ] **Step 3: Run the parity test**

Run: `npm test -- locales`
Expected: PASS (`onlyPt: [], onlyEn: []`).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/pt.json src/i18n/locales/en.json
git commit -m "i18n: add transfer + settings.data + catalogActions.export keys"
```

---

### Task 2: `mapWithConcurrency` utility

**Files:**
- Create: `src/utils/mapWithConcurrency.ts`
- Test: `src/utils/mapWithConcurrency.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/mapWithConcurrency.test.ts
import { mapWithConcurrency } from './mapWithConcurrency';

describe('mapWithConcurrency', () => {
  it('maps all items preserving order', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let active = 0;
    let peak = 0;
    const resolvers: Array<() => void> = [];
    const run = mapWithConcurrency([0, 1, 2, 3, 4], 2, (_n) => {
      active++;
      peak = Math.max(peak, active);
      return new Promise<number>((resolve) => {
        resolvers.push(() => {
          active--;
          resolve(0);
        });
      });
    });
    // Let microtasks schedule, then drain.
    await Promise.resolve();
    while (resolvers.length) resolvers.shift()!();
    await run;
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('rejects with AbortError when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => n, ctrl.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mapWithConcurrency`
Expected: FAIL ("Cannot find module './mapWithConcurrency'").

- [ ] **Step 3: Implement**

```typescript
// src/utils/mapWithConcurrency.ts

/** Error thrown/rejected when an operation is aborted via AbortSignal. */
export class AbortError extends Error {
  name = 'AbortError';
  constructor() {
    super('Aborted');
  }
}

/**
 * Map `items` through async `fn` with at most `limit` in flight at once,
 * returning results in input order. Rejects with AbortError if `signal` aborts.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  if (signal?.aborted) throw new AbortError();
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new AbortError();
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mapWithConcurrency`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/mapWithConcurrency.ts src/utils/mapWithConcurrency.test.ts
git commit -m "feat: add mapWithConcurrency bounded-parallel async map"
```

---

### Task 3: `transferCooldown` (shared 10-min cooldown)

**Files:**
- Create: `src/services/transferCooldown.ts`
- Test: `src/services/transferCooldown.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/transferCooldown.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCooldownRemainingMs, startCooldown, COOLDOWN_MS } from './transferCooldown';

describe('transferCooldown', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('reports 0 remaining when never started', async () => {
    await expect(getCooldownRemainingMs()).resolves.toBe(0);
  });

  it('reports full duration immediately after start', async () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await startCooldown();
    await expect(getCooldownRemainingMs()).resolves.toBe(COOLDOWN_MS);
  });

  it('reports 0 after the window elapses', async () => {
    const start = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(start);
    await startCooldown();
    jest.spyOn(Date, 'now').mockReturnValue(start + COOLDOWN_MS + 1);
    await expect(getCooldownRemainingMs()).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- transferCooldown`
Expected: FAIL ("Cannot find module './transferCooldown'").

- [ ] **Step 3: Implement**

```typescript
// src/services/transferCooldown.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Shared cooldown across export AND import. 10 minutes. */
export const COOLDOWN_MS = 10 * 60 * 1000;
const KEY = '@catalogify/transfer-cooldown-until';

/** Milliseconds remaining on the shared cooldown; 0 when free. */
export async function getCooldownRemainingMs(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return 0;
  const until = Number(raw);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

/** Start (or restart) the shared cooldown from now. */
export async function startCooldown(): Promise<void> {
  await AsyncStorage.setItem(KEY, String(Date.now() + COOLDOWN_MS));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- transferCooldown`
Expected: PASS (3 tests). (`jest-expo` provides the AsyncStorage mock automatically.)

- [ ] **Step 5: Commit**

```bash
git add src/services/transferCooldown.ts src/services/transferCooldown.test.ts
git commit -m "feat: add shared 10-minute transfer cooldown"
```

---

### Task 4: `catalogArchive` — types + `buildArchive`

**Files:**
- Create: `src/services/catalogArchive.ts`
- Test: `src/services/catalogArchive.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/catalogArchive.test.ts
import { unzipSync, strFromU8 } from 'fflate';
import { buildArchive, ARCHIVE_FORMAT_VERSION } from './catalogArchive';
import { CatalogList, CatalogItem } from '../domain/types';

const list: CatalogList = {
  id: 'L1',
  name: 'Wines',
  fields: [{ key: 'rating', label: 'Rating', type: 'rating', required: false, ratingScale: { max: 5 } }],
  coverUrl: 'https://x/cover.jpg',
  createdAt: 111,
};
const items: CatalogItem[] = [
  { id: 'I1', listId: 'L1', title: 'Barolo', values: { rating: 4 }, photoUrl: 'https://x/1.jpg', createdAt: 1, updatedAt: 2 },
  { id: 'I2', listId: 'L1', title: 'Chianti', values: { rating: 3 }, createdAt: 3, updatedAt: 4 },
];

describe('buildArchive', () => {
  it('emits data.json with version, catalog (no id) and items (no id), plus referenced images', () => {
    const photos = new Map<string, Uint8Array>([
      ['images/cover.jpg', new Uint8Array([1, 2, 3])],
      ['images/0.jpg', new Uint8Array([4, 5])],
    ]);
    const zip = buildArchive(list, items, photos);
    const files = unzipSync(zip);

    expect(Object.keys(files).sort()).toEqual(
      ['data.json', 'images/0.jpg', 'images/cover.jpg'].sort()
    );
    const data = JSON.parse(strFromU8(files['data.json']));
    expect(data.formatVersion).toBe(ARCHIVE_FORMAT_VERSION);
    expect(data.catalog).toEqual({ name: 'Wines', fields: list.fields, coverImage: 'images/cover.jpg' });
    expect(data.items).toEqual([
      { title: 'Barolo', values: { rating: 4 }, image: 'images/0.jpg', createdAt: 1, updatedAt: 2 },
      { title: 'Chianti', values: { rating: 3 }, image: null, createdAt: 3, updatedAt: 4 },
    ]);
    expect(Array.from(files['images/0.jpg'])).toEqual([4, 5]);
  });

  it('sets coverImage null when no cover bytes are provided', () => {
    const zip = buildArchive({ ...list, coverUrl: undefined }, [], new Map());
    const data = JSON.parse(strFromU8(unzipSync(zip)['data.json']));
    expect(data.catalog.coverImage).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalogArchive`
Expected: FAIL ("Cannot find module './catalogArchive'").

- [ ] **Step 3: Implement `buildArchive` (and shared types)**

```typescript
// src/services/catalogArchive.ts
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { CatalogItem, CatalogList, FieldDef, FieldValue } from '../domain/types';

export const ARCHIVE_FORMAT_VERSION = 1;
export const DATA_ENTRY = 'data.json';
export const COVER_ENTRY = 'images/cover.jpg';
export const itemImageEntry = (index: number) => `images/${index}.jpg`;

export interface ArchiveItem {
  title: string;
  values: Record<string, FieldValue>;
  image: string | null;
  createdAt: number;
  updatedAt: number;
}
export interface ArchiveCatalog {
  name: string;
  fields: FieldDef[];
  coverImage: string | null;
}
export interface ArchiveData {
  formatVersion: number;
  app: 'catalogify';
  exportedAt: number;
  catalog: ArchiveCatalog;
  items: ArchiveItem[];
}

/**
 * Build a catalog export zip. `photos` maps archive entry paths
 * (e.g. "images/0.jpg", "images/cover.jpg") to their raw bytes; only paths
 * present in the map are written and referenced.
 */
export function buildArchive(
  list: CatalogList,
  items: CatalogItem[],
  photos: Map<string, Uint8Array>
): Uint8Array {
  const coverImage = photos.has(COVER_ENTRY) ? COVER_ENTRY : null;
  const archiveItems: ArchiveItem[] = items.map((item, i) => {
    const entry = itemImageEntry(i);
    return {
      title: item.title,
      values: item.values,
      image: photos.has(entry) ? entry : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  const data: ArchiveData = {
    formatVersion: ARCHIVE_FORMAT_VERSION,
    app: 'catalogify',
    exportedAt: Date.now(),
    catalog: { name: list.name, fields: list.fields, coverImage },
    items: archiveItems,
  };

  const files: Record<string, Uint8Array> = {
    [DATA_ENTRY]: strToU8(JSON.stringify(data)),
  };
  for (const [path, bytes] of photos) files[path] = bytes;

  return zipSync(files, { level: 6 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalogArchive`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/catalogArchive.ts src/services/catalogArchive.test.ts
git commit -m "feat: buildArchive — zip a catalog to data.json + images"
```

---

### Task 5: `catalogArchive` — `parseArchive` + validation

**Files:**
- Modify: `src/services/catalogArchive.ts`
- Test: `src/services/catalogArchive.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/services/catalogArchive.test.ts`:
```typescript
import { zipSync, strToU8 } from 'fflate';
import { parseArchive, ArchiveErrorCode } from './catalogArchive';

function makeZip(data: unknown, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ 'data.json': strToU8(JSON.stringify(data)), ...extra });
}

describe('parseArchive', () => {
  const valid = {
    formatVersion: 1,
    app: 'catalogify',
    exportedAt: 5,
    catalog: { name: 'Wines', fields: [], coverImage: 'images/cover.jpg' },
    items: [{ title: 'Barolo', values: { rating: 4 }, image: 'images/0.jpg', createdAt: 1, updatedAt: 2 }],
  };

  it('parses a valid archive and returns catalog, items and photo bytes', () => {
    const zip = makeZip(valid, {
      'images/cover.jpg': new Uint8Array([9]),
      'images/0.jpg': new Uint8Array([8]),
    });
    const res = parseArchive(zip);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.catalog.name).toBe('Wines');
    expect(res.data.items[0].title).toBe('Barolo');
    expect(Array.from(res.photos.get('images/cover.jpg')!)).toEqual([9]);
    expect(Array.from(res.photos.get('images/0.jpg')!)).toEqual([8]);
  });

  it('rejects a zip with no data.json', () => {
    const zip = zipSync({ 'other.txt': strToU8('hi') });
    const res = parseArchive(zip);
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects malformed json', () => {
    const zip = zipSync({ 'data.json': strToU8('{ not json') });
    expect(parseArchive(zip)).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects a newer formatVersion', () => {
    const res = parseArchive(makeZip({ ...valid, formatVersion: 2 }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.UnsupportedVersion });
  });

  it('rejects when required shape is missing (no catalog.name)', () => {
    const res = parseArchive(makeZip({ ...valid, catalog: { fields: [], coverImage: null } }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects bytes that are not a valid zip', () => {
    expect(parseArchive(new Uint8Array([1, 2, 3, 4]))).toMatchObject({
      ok: false,
      code: ArchiveErrorCode.Invalid,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- catalogArchive`
Expected: FAIL ("parseArchive is not a function" / "ArchiveErrorCode is not defined").

- [ ] **Step 3: Implement `parseArchive`**

Append to `src/services/catalogArchive.ts`:
```typescript
export enum ArchiveErrorCode {
  Invalid = 'invalid',
  UnsupportedVersion = 'unsupportedVersion',
}
export type ParseResult =
  | { ok: true; data: ArchiveData; photos: Map<string, Uint8Array> }
  | { ok: false; code: ArchiveErrorCode };

function isFieldValue(v: unknown): v is FieldValue {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}
function isArchiveItem(v: unknown): v is ArchiveItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.values === 'object' &&
    o.values !== null &&
    Object.values(o.values as Record<string, unknown>).every(isFieldValue) &&
    (o.image === null || typeof o.image === 'string') &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number'
  );
}
function isArchiveData(v: unknown): v is ArchiveData {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const c = o.catalog as Record<string, unknown> | undefined;
  return (
    typeof o.formatVersion === 'number' &&
    !!c &&
    typeof c.name === 'string' &&
    Array.isArray(c.fields) &&
    (c.coverImage === null || typeof c.coverImage === 'string') &&
    Array.isArray(o.items) &&
    o.items.every(isArchiveItem)
  );
}

/** Parse and validate an export zip. Never throws — returns a tagged result. */
export function parseArchive(zipBytes: Uint8Array): ParseResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch {
    return { ok: false, code: ArchiveErrorCode.Invalid };
  }
  const dataBytes = files[DATA_ENTRY];
  if (!dataBytes) return { ok: false, code: ArchiveErrorCode.Invalid };

  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(dataBytes));
  } catch {
    return { ok: false, code: ArchiveErrorCode.Invalid };
  }
  if (!isArchiveData(parsed)) return { ok: false, code: ArchiveErrorCode.Invalid };
  if (parsed.formatVersion > ARCHIVE_FORMAT_VERSION) {
    return { ok: false, code: ArchiveErrorCode.UnsupportedVersion };
  }

  const photos = new Map<string, Uint8Array>();
  for (const [path, bytes] of Object.entries(files)) {
    if (path !== DATA_ENTRY) photos.set(path, bytes);
  }
  return { ok: true, data: parsed, photos };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- catalogArchive`
Expected: PASS (all buildArchive + parseArchive tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/catalogArchive.ts src/services/catalogArchive.test.ts
git commit -m "feat: parseArchive — validate + unzip a catalog export"
```

---

### Task 6: `catalogTransfer` — `TransferIo` boundary + real implementation

**Files:**
- Create: `src/services/catalogTransfer.ts`

This task introduces the I/O boundary and its real Expo-backed implementation. `realTransferIo` is device-verified (Task 13), not unit-tested; the orchestration that uses it is tested in Tasks 7–8 with a fake.

- [ ] **Step 1: Implement the interface + realTransferIo**

```typescript
// src/services/catalogTransfer.ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Injectable I/O boundary so orchestration is testable without native modules. */
export interface TransferIo {
  /** Fetch a URL's bytes; rejects (AbortError) if the signal aborts. */
  downloadToBytes(url: string, signal?: AbortSignal): Promise<Uint8Array>;
  /** Write bytes to a fresh temp file in cache; returns a file:// uri. */
  writeTempFile(name: string, bytes: Uint8Array): Promise<string>;
  /** Present the OS share sheet for a file uri. */
  share(uri: string, mimeType: string, dialogTitle: string): Promise<void>;
  /** Best-effort delete of temp files by uri. */
  cleanup(uris: string[]): void;
}

export class SharingUnavailableError extends Error {
  name = 'SharingUnavailableError';
}

export const realTransferIo: TransferIo = {
  async downloadToBytes(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
  async writeTempFile(name, bytes) {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.writeBytes(bytes);
    return file.uri;
  },
  async share(uri, mimeType, dialogTitle) {
    if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
    await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: 'public.zip-archive' });
  },
  cleanup(uris) {
    for (const uri of uris) {
      try {
        new File(uri).delete();
      } catch {
        // best-effort
      }
    }
  },
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/catalogTransfer.ts
git commit -m "feat: TransferIo boundary + Expo-backed realTransferIo"
```

---

### Task 7: `catalogTransfer` — `exportCatalog`

**Files:**
- Modify: `src/services/catalogTransfer.ts`
- Create: `src/services/catalogTransfer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/catalogTransfer.test.ts
import { unzipSync, strFromU8 } from 'fflate';
import { exportCatalog, importCatalog, TransferIo } from './catalogTransfer';
import { CatalogList, CatalogItem } from '../domain/types';

const list: CatalogList = { id: 'L1', name: 'Wines', fields: [], coverUrl: 'https://x/cover.jpg', createdAt: 1 };
const items: CatalogItem[] = [
  { id: 'I1', listId: 'L1', title: 'Barolo', values: {}, photoUrl: 'https://x/1.jpg', createdAt: 1, updatedAt: 2 },
  { id: 'I2', listId: 'L1', title: 'Chianti', values: {}, createdAt: 3, updatedAt: 4 },
];

function fakeIo(overrides: Partial<TransferIo> = {}): TransferIo & { written: Map<string, Uint8Array> } {
  const written = new Map<string, Uint8Array>();
  return {
    written,
    downloadToBytes: async (url) => new Uint8Array([url.length]),
    writeTempFile: async (name, bytes) => {
      written.set(name, bytes);
      return `file:///tmp/${name}`;
    },
    share: async () => {},
    cleanup: () => {},
    ...overrides,
  };
}

describe('exportCatalog', () => {
  it('downloads cover + item photos, builds a zip, and shares it', async () => {
    const io = fakeIo();
    const repo = { getItems: jest.fn().mockResolvedValue(items) } as any;
    const shareSpy = jest.spyOn(io, 'share');
    const phases: string[] = [];

    await exportCatalog(repo, list, io, { onProgress: (p) => phases.push(p.phase) });

    expect(repo.getItems).toHaveBeenCalledWith('L1');
    // temp zip written + shared
    expect([...io.written.keys()][0]).toMatch(/\.zip$/);
    expect(shareSpy).toHaveBeenCalled();
    // zip has cover + one item image (I2 has no photo)
    const zip = [...io.written.values()][0];
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['data.json', 'images/0.jpg', 'images/cover.jpg'].sort());
    const data = JSON.parse(strFromU8(files['data.json']));
    expect(data.items[1].image).toBeNull();
    expect(phases).toContain('download');
    expect(phases).toContain('share');
  });

  it('continues (image null) when a photo download fails', async () => {
    const io = fakeIo({
      downloadToBytes: async (url) => {
        if (url === 'https://x/1.jpg') throw new Error('404');
        return new Uint8Array([1]);
      },
    });
    const repo = { getItems: jest.fn().mockResolvedValue(items) } as any;
    await exportCatalog(repo, list, io, {});
    const files = unzipSync([...io.written.values()][0]);
    expect(files['images/0.jpg']).toBeUndefined(); // failed item photo omitted
    expect(files['images/cover.jpg']).toBeDefined(); // cover succeeded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalogTransfer`
Expected: FAIL ("exportCatalog is not a function").

- [ ] **Step 3: Implement `exportCatalog`**

Append to `src/services/catalogTransfer.ts` (add imports at top of file):
```typescript
import { CatalogItem, CatalogList } from '../domain/types';
import { buildArchive, COVER_ENTRY, itemImageEntry } from './catalogArchive';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';

const PHOTO_CONCURRENCY = 3;

export type TransferPhase = 'download' | 'build' | 'share' | 'read' | 'finishing';
export interface TransferProgress {
  phase: TransferPhase;
  done?: number;
  total?: number;
}
export interface TransferOptions {
  onProgress?: (p: TransferProgress) => void;
  signal?: AbortSignal;
}

interface CatalogRepoLike {
  getItems(listId: string): Promise<CatalogItem[]>;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'catalog';
}

/**
 * Export one catalog to a shareable zip. Photos download with bounded
 * concurrency; a failed photo download is skipped (its item exports image:null).
 * Returns the shared temp zip uri.
 */
export async function exportCatalog(
  repo: CatalogRepoLike,
  list: CatalogList,
  io: TransferIo,
  { onProgress, signal }: TransferOptions
): Promise<string> {
  const items = await repo.getItems(list.id);

  // Build the download plan: (archive entry path, source url).
  const plan: Array<{ entry: string; url: string }> = [];
  if (list.coverUrl) plan.push({ entry: COVER_ENTRY, url: list.coverUrl });
  items.forEach((item, i) => {
    if (item.photoUrl) plan.push({ entry: itemImageEntry(i), url: item.photoUrl });
  });

  const photos = new Map<string, Uint8Array>();
  let done = 0;
  onProgress?.({ phase: 'download', done, total: plan.length });
  await mapWithConcurrency(
    plan,
    PHOTO_CONCURRENCY,
    async ({ entry, url }) => {
      try {
        photos.set(entry, await io.downloadToBytes(url, signal));
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e; // cancellation propagates
        // best-effort: skip failed photo (object deleted / expired url)
      } finally {
        done++;
        onProgress?.({ phase: 'download', done, total: plan.length });
      }
    },
    signal
  );

  onProgress?.({ phase: 'build' });
  const zip = buildArchive(list, items, photos);
  const uri = await io.writeTempFile(`${sanitizeName(list.name)}-catalogify.zip`, zip);

  onProgress?.({ phase: 'share' });
  await io.share(uri, 'application/zip', list.name);
  return uri;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalogTransfer`
Expected: PASS (2 exportCatalog tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/catalogTransfer.ts src/services/catalogTransfer.test.ts
git commit -m "feat: exportCatalog — gather, download photos, zip, share"
```

---

### Task 8: `catalogTransfer` — `importCatalog`

**Files:**
- Modify: `src/services/catalogTransfer.ts`
- Modify: `src/services/catalogTransfer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/services/catalogTransfer.test.ts`:
```typescript
import { buildArchive } from './catalogArchive';
import { ArchiveErrorCode } from './catalogArchive';
import { ImportError } from './catalogTransfer';

describe('importCatalog', () => {
  function makeRepo() {
    const created: any[] = [];
    const added: any[] = [];
    return {
      created,
      added,
      createList: jest.fn(async (name: string, fields: any[], coverUri?: string) => {
        const l = { id: 'NEW', name, fields, coverUrl: coverUri, createdAt: 9 };
        created.push({ name, fields, coverUri });
        return l;
      }),
      addItem: jest.fn(async (listId: string, title: string, values: any, photoUri?: string) => {
        added.push({ listId, title, values, photoUri });
        return { id: 'x', listId, title, values, createdAt: 1, updatedAt: 1 };
      }),
    };
  }

  it('recreates the catalog then adds each item, passing temp photo uris', async () => {
    const list = { id: 'L1', name: 'Wines', fields: [], coverUrl: 'https://x/cover.jpg', createdAt: 1 } as any;
    const items = [
      { id: 'I1', listId: 'L1', title: 'Barolo', values: { rating: 4 }, photoUrl: 'https://x/1.jpg', createdAt: 1, updatedAt: 2 },
      { id: 'I2', listId: 'L1', title: 'Chianti', values: {}, createdAt: 3, updatedAt: 4 },
    ] as any;
    const zip = buildArchive(list, items, new Map([
      ['images/cover.jpg', new Uint8Array([1])],
      ['images/0.jpg', new Uint8Array([2])],
    ]));

    const io = fakeIo();
    const repo = makeRepo();
    const created = await importCatalog(repo as any, zip, io, {});

    expect(created.id).toBe('NEW');
    expect(repo.createList).toHaveBeenCalledTimes(1);
    expect(repo.created[0].name).toBe('Wines');
    expect(repo.created[0].coverUri).toMatch(/^file:/); // cover written to temp then passed
    expect(repo.addItem).toHaveBeenCalledTimes(2);
    expect(repo.added[0].title).toBe('Barolo');
    expect(repo.added[0].photoUri).toMatch(/^file:/);
    expect(repo.added[1].title).toBe('Chianti');
    expect(repo.added[1].photoUri).toBeUndefined(); // no photo
  });

  it('throws ImportError(invalidFile) for a non-archive', async () => {
    const io = fakeIo();
    const repo = makeRepo();
    await expect(importCatalog(repo as any, new Uint8Array([1, 2, 3]), io, {})).rejects.toMatchObject({
      name: 'ImportError',
      code: ArchiveErrorCode.Invalid,
    });
    expect(repo.createList).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- catalogTransfer`
Expected: FAIL ("importCatalog is not a function" / "ImportError is not defined").

- [ ] **Step 3: Implement `importCatalog` + `ImportError`**

Append to `src/services/catalogTransfer.ts` (add `parseArchive`, `ArchiveErrorCode`, `FieldDef`, `FieldValue` to imports):
```typescript
// add to existing imports:
// import { buildArchive, COVER_ENTRY, itemImageEntry, parseArchive, ArchiveErrorCode } from './catalogArchive';
// import { CatalogItem, CatalogList, FieldDef, FieldValue } from '../domain/types';

export class ImportError extends Error {
  name = 'ImportError';
  constructor(public code: ArchiveErrorCode) {
    super(`import failed: ${code}`);
  }
}

interface ImportRepoLike {
  createList(name: string, fields: FieldDef[], coverUri?: string): Promise<CatalogList>;
  addItem(
    listId: string,
    title: string,
    values: Record<string, FieldValue>,
    photoUri?: string
  ): Promise<CatalogItem>;
}

/**
 * Import a catalog zip, always creating a NEW catalog. Cancellable during the
 * parse/write prep phase; once the commit (createList/addItem) begins it runs to
 * completion. Photos are written to temp files and replayed through the repo,
 * which re-uploads them to the importer's own storage. Returns the new catalog.
 */
export async function importCatalog(
  repo: ImportRepoLike,
  zipBytes: Uint8Array,
  io: TransferIo,
  { onProgress, signal }: TransferOptions
): Promise<CatalogList> {
  onProgress?.({ phase: 'read' });
  const parsed = parseArchive(zipBytes);
  if (!parsed.ok) throw new ImportError(parsed.code);
  if (signal?.aborted) throw new ImportError(ArchiveErrorCode.Invalid);

  const { data, photos } = parsed;
  const tempUris: string[] = [];

  // Write every referenced photo to a temp file (prep phase, cancellable).
  async function tempUriFor(entry: string | null): Promise<string | undefined> {
    if (!entry) return undefined;
    const bytes = photos.get(entry);
    if (!bytes) return undefined; // referenced but missing → skip photo
    const uri = await io.writeTempFile(`import-${tempUris.length}.jpg`, bytes);
    tempUris.push(uri);
    return uri;
  }

  try {
    const coverUri = await tempUriFor(data.catalog.coverImage);
    const itemUris = await Promise.all(data.items.map((it) => tempUriFor(it.image)));
    if (signal?.aborted) throw new ImportError(ArchiveErrorCode.Invalid);

    // Commit phase (no longer cancellable).
    onProgress?.({ phase: 'finishing' });
    const list = await repo.createList(data.catalog.name, data.catalog.fields, coverUri);
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      await repo.addItem(list.id, it.title, it.values, itemUris[i]);
    }
    return list;
  } finally {
    io.cleanup(tempUris);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- catalogTransfer`
Expected: PASS (export + import tests).

- [ ] **Step 5: Full verify + commit**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.
```bash
git add src/services/catalogTransfer.ts src/services/catalogTransfer.test.ts
git commit -m "feat: importCatalog — parse, re-upload photos, create new catalog"
```

---

### Task 9: `useCatalogTransfer` hooks

**Files:**
- Create: `src/hooks/useCatalogTransfer.ts`

UI glue — manages phase/progress/cooldown/error state, the in-flight guard, document picking, and cache invalidation. Device-verified (Task 13); no unit test (pure logic already lives in the tested service/util layers).

- [ ] **Step 1: Implement**

```typescript
// src/hooks/useCatalogTransfer.ts
import { useCallback, useState } from 'react';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CatalogList } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { catalogKeys } from './useCatalogQueries';
import {
  exportCatalog,
  importCatalog,
  realTransferIo,
  ImportError,
  SharingUnavailableError,
  TransferProgress,
} from '../services/catalogTransfer';
import { ArchiveErrorCode } from '../services/catalogArchive';
import { getCooldownRemainingMs, startCooldown } from '../services/transferCooldown';

export interface TransferState {
  running: boolean;
  progress: TransferProgress | null;
  error: string | null;
  cooldownRemainingMs: number;
}

const idle: TransferState = { running: false, progress: null, error: null, cooldownRemainingMs: 0 };

function messageForError(err: unknown, t: (k: string) => string): string {
  if (err instanceof SharingUnavailableError) return t('transfer.sharingUnavailable');
  if (err instanceof ImportError) {
    return err.code === ArchiveErrorCode.UnsupportedVersion
      ? t('transfer.unsupportedVersion')
      : t('transfer.invalidFile');
  }
  return t('transfer.genericError');
}

/** Export flow for a single catalog. */
export function useCatalogExport(list: CatalogList) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [state, setState] = useState<TransferState>(idle);

  const refreshCooldown = useCallback(async () => {
    setState((s) => ({ ...s, cooldownRemainingMs: await getCooldownRemainingMs() }));
  }, []);

  const run = useCallback(async () => {
    if (!user?.uid || state.running) return;
    if ((await getCooldownRemainingMs()) > 0) {
      await refreshCooldown();
      return;
    }
    setState({ ...idle, running: true });
    try {
      const repo = new FirebaseCatalogRepository(user.uid);
      await exportCatalog(repo, list, realTransferIo, {
        onProgress: (progress) => setState((s) => ({ ...s, progress })),
      });
      await startCooldown();
      setState({ ...idle, cooldownRemainingMs: await getCooldownRemainingMs() });
    } catch (err) {
      setState({ ...idle, error: messageForError(err, t) });
    }
  }, [user?.uid, state.running, list, t, refreshCooldown]);

  const reset = useCallback(() => setState((s) => ({ ...s, error: null, progress: null })), []);
  return { ...state, run, reset, refreshCooldown };
}

/** Import flow — picks a file, imports, refreshes Home. */
export function useCatalogImport() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [state, setState] = useState<TransferState>(idle);

  const refreshCooldown = useCallback(async () => {
    setState((s) => ({ ...s, cooldownRemainingMs: await getCooldownRemainingMs() }));
  }, []);

  const run = useCallback(async () => {
    if (!user?.uid || state.running) return;
    if ((await getCooldownRemainingMs()) > 0) {
      await refreshCooldown();
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;

    setState({ ...idle, running: true });
    try {
      const bytes = await new File(picked.assets[0].uri).bytes();
      const repo = new FirebaseCatalogRepository(user.uid);
      await importCatalog(repo, bytes, realTransferIo, {
        onProgress: (progress) => setState((s) => ({ ...s, progress })),
      });
      qc.invalidateQueries({ queryKey: catalogKeys.lists(user.uid) });
      qc.invalidateQueries({ queryKey: catalogKeys.counts(user.uid) });
      await startCooldown();
      setState({ ...idle, cooldownRemainingMs: await getCooldownRemainingMs() });
    } catch (err) {
      setState({ ...idle, error: messageForError(err, t) });
    }
  }, [user?.uid, state.running, qc, t, refreshCooldown]);

  const reset = useCallback(() => setState((s) => ({ ...s, error: null, progress: null })), []);
  return { ...state, run, reset, refreshCooldown };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCatalogTransfer.ts
git commit -m "feat: useCatalogExport/useCatalogImport UI state hooks"
```

---

### Task 10: `TransferProgressModal` component

**Files:**
- Create: `src/components/TransferProgressModal.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/TransferProgressModal.tsx
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';
import { TransferProgress } from '../services/catalogTransfer';

interface Props {
  visible: boolean;
  progress: TransferProgress | null;
}

/** Blocking progress overlay shown while an export/import runs. */
export function TransferProgressModal({ visible, progress }: Props) {
  const { t } = useTranslation();

  let label = t('transfer.preparing');
  if (progress?.phase === 'download') {
    label = t('transfer.downloading', { done: progress.done ?? 0, total: progress.total ?? 0 });
  } else if (progress?.phase === 'build') label = t('transfer.building');
  else if (progress?.phase === 'read') label = t('transfer.reading');
  else if (progress?.phase === 'finishing') label = t('transfer.finishing');

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="bg-background rounded-xl px-8 py-7 items-center gap-4 min-w-[220px]">
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text className="font-body-md text-body-md text-on-background text-center">{label}</Text>
        </View>
      </View>
    </Modal>
  );
}
```
(Note: cancel is intentionally omitted from v1 UI — the design allows cancel during prep, but the download phase is short at personal-catalog scale; add a cancel button here later wired to an `AbortController` passed via `signal` if on-device testing shows long exports. The service already supports `signal`.)

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TransferProgressModal.tsx
git commit -m "feat: TransferProgressModal progress overlay"
```

---

### Task 11: Wire Export into the catalog action sheet

**Files:**
- Modify: `src/components/CatalogActionsSheet.tsx`
- Modify: `src/screens/ListDetailScreen.tsx`

- [ ] **Step 1: Add an `onExport` prop + Export row to `CatalogActionsSheet`**

In `src/components/CatalogActionsSheet.tsx`, extend the props interface:
```tsx
interface CatalogActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}
```
Update the destructure: `export function CatalogActionsSheet({ visible, onClose, onEdit, onExport, onDelete }: CatalogActionsSheetProps) {`

Insert an Export `Pressable` between the Edit and Delete rows (mirror the existing row markup):
```tsx
<Pressable
  onPress={onExport}
  className="flex-row items-center gap-4 px-5 py-5"
  accessibilityRole="button"
  accessibilityLabel={t('catalogActions.export')}
>
  <MaterialIcons name="ios-share" size={22} color={theme.colors.onSurfaceVariant} />
  <Text className="font-body-lg text-body-lg text-on-background">
    {t('catalogActions.export')}
  </Text>
</Pressable>
```

- [ ] **Step 2: Wire export in `ListDetailScreen`**

Locate where `<CatalogActionsSheet .../>` is rendered in `src/screens/ListDetailScreen.tsx` and where the current catalog (`CatalogList`) is in scope. Add near the other hooks:
```tsx
import { useCatalogExport } from '../hooks/useCatalogTransfer';
import { TransferProgressModal } from '../components/TransferProgressModal';
// ...inside the component, where `list: CatalogList` is available:
const exporter = useCatalogExport(list);
```
Pass the handler to the sheet (close the sheet first, then run):
```tsx
<CatalogActionsSheet
  // ...existing props
  onExport={() => {
    setSheetVisible(false); // use whatever state var currently controls the sheet
    void exporter.run();
  }}
/>
```
Render the progress modal (near the sheet):
```tsx
<TransferProgressModal visible={exporter.running} progress={exporter.progress} />
```
If `exporter.error` is set, surface it with the screen's existing error/toast mechanism (or an `Alert.alert(t('common.error'), exporter.error)` then `exporter.reset()`). Match the file's existing error-handling pattern.

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CatalogActionsSheet.tsx src/screens/ListDetailScreen.tsx
git commit -m "feat: export action in catalog sheet wired to export flow"
```

---

### Task 12: Wire Import into Settings

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add a Data section with an Import row**

In `src/screens/SettingsScreen.tsx`, add imports:
```tsx
import { useCatalogImport } from '../hooks/useCatalogTransfer';
import { TransferProgressModal } from '../components/TransferProgressModal';
import { Alert } from 'react-native';
import { useEffect } from 'react';
```
Inside the component, before `return`:
```tsx
const importer = useCatalogImport();
useEffect(() => {
  if (importer.error) {
    Alert.alert(t('settings.title'), importer.error);
    importer.reset();
  }
}, [importer.error]);
```
Add the Data section after the language list (inside the root `View`, after the `SUPPORTED_LANGUAGES.map(...)` block):
```tsx
<Text className="px-5 pt-6 pb-2 font-label-md text-label-md text-secondary uppercase tracking-widest">
  {t('settings.dataSection')}
</Text>
<Pressable
  onPress={() => void importer.run()}
  disabled={importer.running}
  accessibilityRole="button"
  accessibilityLabel={t('settings.importCatalog')}
  className="flex-row items-center justify-between px-5 py-4 border-b border-outline-variant/30"
>
  <Text className="font-body-md text-body-md text-on-surface">{t('settings.importCatalog')}</Text>
  <MaterialIcons name="file-download" size={22} color={theme.colors.onSurfaceVariant} />
</Pressable>
<TransferProgressModal visible={importer.running} progress={importer.progress} />
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: import catalog action in Settings › Data"
```

---

### Task 13: On-device verification (human)

**Files:** none (manual)

Requires a fresh dev-client build (new native modules: `expo-file-system`, `expo-sharing`, `expo-document-picker`). The human runs the build.

- [ ] **Step 1: Rebuild the dev client** (`npx expo run:android` / `run:ios`, per the release recipe).
- [ ] **Step 2: Export** — open a catalog with photos → ⋮ → Export catalog. Confirm: progress overlay shows "Downloading n/N" → share sheet appears → a `<name>-catalogify.zip` can be saved/sent.
- [ ] **Step 3: Inspect the zip** (optional) — contains `data.json` + `images/`.
- [ ] **Step 4: Import** — Settings › Data › Import catalog → pick the zip. Confirm: a NEW catalog appears on Home (name possibly duplicated alongside the original), items + typed values intact, photos + cover render (re-uploaded to your storage).
- [ ] **Step 5: Cooldown** — immediately try export or import again → action is blocked for 10 min (shared). Confirm it survives an app restart.
- [ ] **Step 6: Error paths** — import a non-zip / a text file → friendly "invalid file" message, no crash. Import with airplane mode after picking → generic error, no partial catalog left (or a deletable partial).
- [ ] **Step 7: i18n** — switch language in Settings; all transfer strings localize (PT/EN).

---

## Self-review notes
- **Spec coverage:** zip bundle (T4), JSON-only round-trip (T4/T5), always-create-new (T8), photos re-uploaded via existing repo (T8/T9), fflate (T4/T5), limited-concurrency download (T2/T7), progress (T7/T10), in-flight guard (T9), shared 10-min cooldown persisted (T3/T9), export in sheet (T11), import in Settings›Data (T12), validation/error handling (T5/T7/T8/T9), i18n both files (T1), new native deps + dev rebuild (T0/T13). All covered.
- **Timestamps:** imported items get import-time createdAt (reuse `addItem`) — matches the approved v1 decision; original values are still carried in `data.json` for forward-compat.
- **Type consistency:** `TransferIo`, `TransferProgress`, `TransferPhase`, `ArchiveData`, `ArchiveErrorCode`, `ImportError`, `catalogKeys` names are used identically across service, hooks, and UI tasks.
- **Cancel:** service supports `signal` end-to-end; v1 UI omits the cancel button (noted in T10) since personal-scale exports are short — a follow-up can add it without service changes.
