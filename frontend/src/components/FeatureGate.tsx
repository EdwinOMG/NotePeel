import { ReactNode, useState, useRef, useEffect } from "react";
import { useUsage } from "../hooks/useUsage";

interface FeatureGateProps {
  feature: string;
  token: string | null;
  onUpgradeClick?: () => void;
  darkMode?: boolean;
  children: ReactNode;
}

/**
 * Wraps any UI that requires a Pro/Premium feature.
 * When locked, renders the children greyed out with a small lock on top.
 * Hover/press shows "Upgrade to X for Y" tooltip to the right (or above on mobile).
 */
export function FeatureGate({ feature, token, onUpgradeClick, darkMode = false, children }: FeatureGateProps) {
  const { usage, isFeatureAllowed } = useUsage(token);
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipSide, setTooltipSide] = useState<'right' | 'above'>('right');

  // Determine tooltip position based on available space
  useEffect(() => {
    if (showTooltip && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // If less than 220px to the right, show above
      const spaceRight = window.innerWidth - rect.right;
      setTooltipSide(spaceRight < 220 ? 'above' : 'right');
    }
  }, [showTooltip]);

  // Still loading or allowed — render children normally
  if (!usage || isFeatureAllowed(feature)) return <>{children}</>;

  const tier = feature === "chat" ? "Premium" : "Pro";
  const label = featureLabel(feature);

  const tooltipStyle: React.CSSProperties = tooltipSide === 'right' ? {
    position: "absolute",
    left: "calc(100% + 10px)",
    top: "50%",
    transform: "translateY(-50%)",
  } : {
    position: "absolute",
    bottom: "calc(100% + 10px)",
    left: "50%",
    transform: "translateX(-50%)",
  };

  const arrowStyle: React.CSSProperties = tooltipSide === 'right' ? {
    position: "absolute",
    right: "100%",
    top: "50%",
    transform: "translateY(-50%)",
    width: 0, height: 0,
    borderTop: "6px solid transparent",
    borderBottom: "6px solid transparent",
    borderRight: `6px solid ${darkMode ? '#555' : '#ddd'}`,
  } : {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    width: 0, height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: `6px solid ${darkMode ? '#555' : '#ddd'}`,
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip(true)}
      onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2500)}
    >
      {/* Greyed-out, non-interactive children */}
      <div style={{ opacity: 0.3, pointerEvents: "none", filter: "grayscale(80%)" }}>
        {children}
      </div>

      {/* Lock icon — directly on top, no circle */}
      <div
        onClick={(e) => { e.stopPropagation(); onUpgradeClick?.(); }}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: onUpgradeClick ? "pointer" : "default",
          zIndex: 2,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.85 }}>🔒</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          ...tooltipStyle,
          background: darkMode ? "#252542" : "#fff",
          border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
          borderRadius: 10,
          padding: "8px 14px",
          zIndex: 9999,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          fontSize: 12,
          color: darkMode ? "#e4e4e7" : "#333",
          fontWeight: 500,
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <span>Upgrade to <strong style={{ color: tier === "Premium" ? "#7C4DFF" : "#FF9800" }}>{tier}</strong> for {label}</span>
          <div style={arrowStyle} />
        </div>
      )}
    </div>
  );
}

function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    flashcards: "Flashcards",
    summarize:  "Summaries",
    explain:    "Explanations",
    scan:       "Note scanning",
    chat:       "Study Chat",
  };
  return labels[feature] ?? feature;
}