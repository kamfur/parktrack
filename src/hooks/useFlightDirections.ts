import { useEffect, useState } from "react";

export function useFlightDirections(): string[] {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/flight-directions", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((body: { data?: unknown }) => {
        setOptions(Array.isArray(body.data) ? body.data.filter((item): item is string => typeof item === "string") : []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setOptions([]);
      });

    return () => controller.abort();
  }, []);

  return options;
}
