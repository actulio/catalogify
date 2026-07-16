import { useEffect, useState } from 'react';

// Returns `value` delayed by `delayMs`, resetting the timer on every change so
// rapid updates (e.g. typing in a search box) only settle once input pauses.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
