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
    const cooldownRemainingMs = await getCooldownRemainingMs();
    setState((s) => ({ ...s, cooldownRemainingMs }));
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
    const cooldownRemainingMs = await getCooldownRemainingMs();
    setState((s) => ({ ...s, cooldownRemainingMs }));
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
