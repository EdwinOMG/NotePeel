import React from "react";
import { useUsage } from "../hooks/useUsage";

interface UsageBannerProps {
  token: string | null;
  onUpgradeClick?: () => void;
  darkMode?: boolean;
}

/**
 * Drop this anywhere in the UI to show the free-tier token usage bar.
 * Returns null for Pro users and while not authenticated.
 *
 * Example:
 *   <UsageBanner token={localStorage.getItem('token')} darkMode={darkMode} />
 */
export function UsageBanner({ token, onUpgradeClick, darkMode = false }: UsageBannerProps) {
  const { usage, percentUsed } = useUsage(token);

  if (!usage || usage.plan === "pro") return null;

  const isWarning   = percentUsed >= 75;
  const isNearLimit = percentUsed >= 90;
  const isExhausted = usage.tokens_remaining_today === 0;

  const barColor = isExhausted ? "#ef4444" : isNearLimit ? "#f97316" : isWarning ? "#eab308" : "#FF9800";
  const bg     = darkMode ? "#2d2d4a" : isExhausted ? "#fff1f1" : "#FFF8E1";
  const border = darkMode ? "#3f3f5a" : isExhausted ? "#fca5a5" : "#FFE082";

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: darkMode ? "#e4e4e7" : "#5D4037", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: isExhausted ? "#dc2626" : "#E65100" }}>
          {isExhausted
            ? "🚫 Daily AI limit reached"
            : `🐵 Free plan · ${usage.tokens_remaining_today.toLocaleString()} tokens left today`}
        </span>
        {onUpgradeClick && (
          <button onClick={onUpgradeClick} style={{ background: "linear-gradient(135deg, #FFC107 0%, #FF9800 100%)", color: "#5D4037", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Upgrade to Pro
          </button>
        )}
      </div>

      <div style={{ background: darkMode ? "#3f3f5a" : "#e5e7eb", borderRadius: 99, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${percentUsed}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: darkMode ? "#a1a1aa" : "#8D6E63", fontSize: 11 }}>
        <span>
          {usage.tokens_used_today.toLocaleString()} / {usage.daily_token_budget.toLocaleString()} tokens
          &nbsp;·&nbsp;
          {usage.requests_made_today} / {usage.max_requests_per_day} requests
        </span>
        <span>Resets at midnight UTC</span>
      </div>

      {isExhausted && (
        <p style={{ margin: 0, color: "#dc2626", fontSize: 12 }}>
          You've used today's free allowance. Upgrade for 50× more tokens and flashcard access.
        </p>
      )}
    </div>
  );
}