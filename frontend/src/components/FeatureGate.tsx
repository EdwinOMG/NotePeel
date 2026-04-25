import { ReactNode } from "react";
import { useUsage } from "../hooks/useUsage";

interface FeatureGateProps {
  feature: string;
  token: string | null;
  onUpgradeClick?: () => void;
  darkMode?: boolean;
  children: ReactNode;
}

/**
 * Wraps any UI that requires a Pro feature.
 * Free users see a blurred preview with a lock overlay.
 *
 * Example:
 *   <FeatureGate feature="flashcards" token={localStorage.getItem('token')} darkMode={darkMode}>
 *     <button onClick={handleGenerateFlashcards}>🃏 Generate Flashcards</button>
 *   </FeatureGate>
 */
export function FeatureGate({ feature, token, onUpgradeClick, darkMode = false, children }: FeatureGateProps) {
  const { usage, isFeatureAllowed } = useUsage(token);

  // Still loading or Pro — render children normally
  if (!usage || isFeatureAllowed(feature)) return <>{children}</>;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Blurred preview */}
      <div style={{ filter: "blur(3px)", pointerEvents: "none", opacity: 0.5 }}>
        {children}
      </div>

      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
        background: darkMode ? "rgba(37,37,66,0.85)" : "rgba(255,255,255,0.85)",
        borderRadius: 10,
      }}>
        <span style={{ fontSize: 28 }}>🔒</span>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: darkMode ? "#e4e4e7" : "#5D4037", textAlign: "center" }}>
          {featureLabel(feature)} is a Pro feature
        </p>
        <p style={{ margin: 0, fontSize: 12, color: darkMode ? "#a1a1aa" : "#8D6E63", textAlign: "center", maxWidth: 220 }}>
          Upgrade to unlock flashcards, higher limits, and more.
        </p>
        {onUpgradeClick && (
          <button onClick={onUpgradeClick} style={{ background: "linear-gradient(135deg, #FFC107 0%, #FF9800 100%)", color: "#5D4037", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            Upgrade to Pro
          </button>
        )}
      </div>
    </div>
  );
}

function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    flashcards: "Flashcards",
    summarize:  "Summaries",
    explain:    "Explanations",
    scan:       "Note scanning",
  };
  return labels[feature] ?? feature;
}