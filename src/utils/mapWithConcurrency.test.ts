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
    while (resolvers.length) {
      resolvers.shift()!();
      await Promise.resolve();
    }
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

  it('stops picking up new work when aborted mid-run', async () => {
    const ctrl = new AbortController();
    const seen: number[] = [];
    const run = mapWithConcurrency(
      [1, 2, 3, 4, 5],
      1, // one at a time so ordering is deterministic
      async (n) => {
        seen.push(n);
        if (n === 2) ctrl.abort(); // abort after the 2nd item begins
        return n;
      },
      ctrl.signal
    );
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    // With limit 1, after item 2 aborts, the worker's next loop iteration throws
    // before item 3 is picked up — so items 4 and 5 are never processed.
    expect(seen).not.toContain(4);
    expect(seen).not.toContain(5);
  });
});
