import { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export interface SearchBarProps {
  /** Wartość wyszukiwania */
  value: string;
  /** Callback wywoływany po zmianie wartości (z debounce) */
  onChange: (value: string) => void;
  /** Placeholder dla inputu */
  placeholder?: string;
  /** Czy trwa wyszukiwanie */
  isLoading?: boolean;
  /** Czas debounce w ms */
  debounceMs?: number;
  /** Czy komponent jest disabled */
  disabled?: boolean;
}

/**
 * Komponent SearchBar z debounce i czyszczeniem
 * Automatycznie debounce'uje zmiany wartości przed wywołaniem onChange
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Szukaj...",
  isLoading = false,
  debounceMs = 300,
  disabled = false,
}: SearchBarProps) {
  // Lokalny stan dla natychmiastowej aktualizacji UI
  const [localValue, setLocalValue] = useState(value);

  // Synchronizuj lokalny stan z zewnętrzną wartością
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  // Handler dla zmiany wartości
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  // Handler dla czyszczenia
  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  // Handler dla Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        // Natychmiastowe wywołanie onChange bez czekania na debounce
        onChange(localValue);
      }
    },
    [localValue, onChange]
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
          aria-label="Wyszukiwanie"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : localValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
              className="h-auto p-0 hover:bg-transparent"
              aria-label="Wyczyść wyszukiwanie"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
