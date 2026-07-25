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
