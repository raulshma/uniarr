import { useEffect, useState } from "react";

/**
 * Debounces a value — returns the latest value after the specified delay.
 * Simple, small, and typed for reuse across the app.
 */
const useDebouncedValue = <T>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
};

export default useDebouncedValue;
