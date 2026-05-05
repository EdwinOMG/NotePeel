import { useUsage } from "../hooks/useUsage";

interface UsageBannerProps {
  token: string | null;
  onUpgradeClick?: () => void;
  darkMode?: boolean;
}

export function UsageBanner({ token, onUpgradeClick, darkMode = false }: UsageBannerProps) {
  const { usage } = useUsage(token);

  if (!usage || usage.plan === "pro" || usage.plan === "premium") return null;

  // Use the new ai_requests structure
  const requestsUsed = usage.ai_requests.daily_used;
  const requestsMax = usage.ai_requests.daily_limit;
  const requestsRemaining = usage.ai_requests.daily_remaining;
  const percentUsed = Math.min(100, Math.round((requestsUsed / requestsMax) * 100));
  const isExhausted = requestsRemaining === 0;
  const isNearLimit = percentUsed >= 90;
  const isWarning = percentUsed >= 75;

  const barColor = isExhausted ? "#ef4444" : isNearLimit ? "#f97316" : isWarning ? "#eab308" : "#FF9800";
  const bg = darkMode ? "#2d2d4a" : isExhausted ? "#fff1f1" : "#FFF8E1";
  const border = darkMode ? "#3f3f5a" : isExhausted ? "#fca5a5" : "#FFE082";

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: darkMode ? "#e4e4e7" : "#5D4037", display: "flex", flexDirection: "column", gap: 6 }}>
      
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: isExhausted ? "#dc2626" : "#E65100" }}>
          {isExhausted
            ? "Daily limit reached"
            : `Free plan · ${requestsRemaining} request${requestsRemaining !== 1 ? 's' : ''} left today`}
        </span>
        {onUpgradeClick && (
          <button onClick={onUpgradeClick} style={{ background: "linear-gradient(135deg, #FFC107 0%, #FF9800 100%)", color: "#5D4037", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Upgrade
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: darkMode ? "#3f3f5a" : "#e5e7eb", borderRadius: 99, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${percentUsed}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", justifyContent: "space-between", color: darkMode ? "#a1a1aa" : "#8D6E63", fontSize: 11 }}>
        <span>
          {requestsUsed} / {requestsMax} requests used
        </span>
        <span>Resets at midnight UTC</span>
      </div>

      {isExhausted && (
        <p style={{ margin: 0, color: "#dc2626", fontSize: 12 }}>
          You've used all your free daily requests. Upgrade for more.
        </p>
      )}
    </div>
  );
}
