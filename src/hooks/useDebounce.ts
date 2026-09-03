import { useEffect, useState } from "react";

/**
 * Hook do debouncing wartości.
 * Opóźnia aktualizację wartości o określony czas.
 *
 * @param value - Wartość do debounce
 * @param delay - Opóźnienie w ms (domyślnie 500ms)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
