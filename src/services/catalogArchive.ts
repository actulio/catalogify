import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
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
const FIELD_TYPES = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];
function isFieldDef(v: unknown): v is FieldDef {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.key === 'string' &&
    typeof o.label === 'string' &&
    typeof o.type === 'string' &&
    FIELD_TYPES.includes(o.type) &&
    typeof o.required === 'boolean'
  );
}
function isArchiveItem(v: unknown): v is ArchiveItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.values === 'object' &&
    o.values !== null &&
    !Array.isArray(o.values) &&
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
    o.app === 'catalogify' &&
    typeof o.exportedAt === 'number' &&
    !!c &&
    typeof c.name === 'string' &&
    Array.isArray(c.fields) &&
    c.fields.every(isFieldDef) &&
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
