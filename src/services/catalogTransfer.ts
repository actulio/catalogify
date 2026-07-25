import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CatalogItem, CatalogList, FieldDef, FieldValue } from '../domain/types';
import { buildArchive, COVER_ENTRY, itemImageEntry, parseArchive, ArchiveErrorCode } from './catalogArchive';
import { mapWithConcurrency } from '../utils/mapWithConcurrency';

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
    file.write(bytes);
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
