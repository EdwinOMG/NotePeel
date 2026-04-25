import { useEffect, useState, useCallback } from "react";
import { usageAPI } from "../services/api";

export interface UsageSummary {
  plan: "free" | "pro";
  daily_token_budget: number;
  tokens_used_today: number;
  tokens_remaining_today: number;
  requests_made_today: number;
  max_requests_per_day: number;
  allowed_features: string[];
  pro_only_features: string[];
  resets_at: string;
}

interface UseUsageReturn {
  usage: UsageSummary | null;
  loading: boolean;
  refresh: () => void;
  isFeatureAllowed: (feature: string) => boolean;
  percentUsed: number;
}

// Pass the token so the hook only runs when the user is actually logged in.
// The token itself isn't used here (api.ts reads it from localStorage), but
// it acts as a signal: when it goes from null → string we start fetching.
export function useUsage(token: string | null): UseUsageReturn {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await usageAPI.getMyUsage();
      setUsage(data);
    } catch {
      // Silently ignore — usage banner is non-critical
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Auto-refresh every 60 seconds so the banner stays accurate
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, [token, fetchUsage]);

  const isFeatureAllowed = useCallback(
    (feature: string) => {
      if (!usage) return true; // optimistic while loading — backend is the real guard
      return usage.allowed_features.includes(feature);
    },
    [usage]
  );

  const percentUsed = usage
    ? Math.min(100, Math.round((usage.tokens_used_today / usage.daily_token_budget) * 100))
    : 0;

  return { usage, loading, refresh: fetchUsage, isFeatureAllowed, percentUsed };
}