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
