import { QueryClient } from '@tanstack/react-query';

// staleTime keeps re-focusing a screen from refetching immediately; all writes go
// through mutations that invalidate the relevant keys, so data still stays fresh.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
