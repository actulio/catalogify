import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { CatalogItem, CatalogList } from '../domain/types';

export const catalogKeys = {
  lists: (uid: string) => ['lists', uid] as const,
  counts: (uid: string) => ['counts', uid] as const,
  items: (uid: string, listId: string) => ['items', uid, listId] as const,
};

export function useLists() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery({
    queryKey: catalogKeys.lists(uid ?? 'anon'),
    enabled: !!uid,
    queryFn: () => new FirebaseCatalogRepository(uid!).getLists(),
  });
}

export function useItemCounts(listIds: string[]) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Record<string, number>>({
    queryKey: [...catalogKeys.counts(uid ?? 'anon'), listIds.slice().sort().join(',')],
    enabled: !!uid && listIds.length > 0,
    queryFn: () => new FirebaseCatalogRepository(uid!).getItemCounts(listIds),
  });
}

export function useItems(listId: string) {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<CatalogItem[]>({
    queryKey: catalogKeys.items(uid ?? 'anon', listId),
    enabled: !!uid,
    queryFn: () => new FirebaseCatalogRepository(uid!).getItems(listId),
  });
}

// Call after any item write so cached items + Home counts refresh.
export function useInvalidateCatalog(listId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid ?? 'anon';
  return () => {
    qc.invalidateQueries({ queryKey: catalogKeys.items(uid, listId) });
    qc.invalidateQueries({ queryKey: catalogKeys.counts(uid) });
    qc.invalidateQueries({ queryKey: catalogKeys.lists(uid) });
  };
}
