import { useEffect, useState, useCallback } from "react";
import { usageAPI } from "../services/api";

export interface UsageSummary {
  plan: "free" | "pro" | "premium";
  ai_requests: {
    daily_used: number;
    daily_limit: number;
    daily_remaining: number;
    monthly_used?: number;
    monthly_limit?: number;
    monthly_remaining?: number;
  };
  ocr: {
    counter: "shared" | "separate";
    daily_remaining?: number;
    monthly_used?: number;
    monthly_limit?: number | "unlimited";
    monthly_remaining?: number;
  };
  allowed_features: string[];
  pro_only_features: string[];
  premium_only_features: string[];
  resets_at: string;
}

interface UseUsageReturn {
  usage: UsageSummary | null;
  loading: boolean;
  refresh: () => void;
  isFeatureAllowed: (feature: string) => boolean;
}

// Pass the token so the hook only runs when the user is actually logged in.
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, [token, fetchUsage]);

  const isFeatureAllowed = useCallback(
    (feature: string) => {
      if (!usage) return true; // optimistic while loading
      return usage.allowed_features.includes(feature);
    },
    [usage]
  );

  return { usage, loading, refresh: fetchUsage, isFeatureAllowed };
}
