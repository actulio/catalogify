import { zipSync, strToU8 } from 'fflate';
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
