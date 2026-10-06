import { useEffect, useState } from "react";
import type { AnalyticsData, AnalyticsGranularity } from "../types";

interface UseAnalyticsResult {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Pobiera statystyki dla strony /statystyki. `from`/`to` to daty Warsaw (YYYY-MM-DD, włącznie).
 */
export function useAnalytics(from: string, to: string, granularity: AnalyticsGranularity): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const query = new URLSearchParams({ from, to, granularity });
    fetch(`/api/stats/analytics?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Nie udało się pobrać statystyk");
        setData(body.data as AnalyticsData);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Nie udało się pobrać statystyk");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [from, to, granularity, attempt]);

  return { data, isLoading, error, retry: () => setAttempt((n) => n + 1) };
}
