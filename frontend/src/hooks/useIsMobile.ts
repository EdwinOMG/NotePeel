import { useState, useEffect } from 'react';

/**
 * Detect if the device should use the mobile layout.
 * Uses screen width AND touch/UA heuristics so iPads (which report
 * desktop-class viewport widths) are still treated as mobile.
 */
function detectIsMobile(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;

  // iPads with iPadOS 13+ report as "Macintosh" in UA but have touch support
  const isIPad =
    navigator.platform === 'iPad' ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Standard mobile UA check
  const isMobileUA = /android|iphone|ipod/i.test(navigator.userAgent);

  // If it's an iPad or mobile UA, always use mobile layout
  if (isIPad || isMobileUA) return true;

  // Otherwise fall back to width
  return window.innerWidth <= breakpoint;
}

export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => detectIsMobile(breakpoint));

  useEffect(() => {
    const checkMobile = () => setIsMobile(detectIsMobile(breakpoint));

    // Listen for resize (still useful for non-touch devices / responsive testing)
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => checkMobile();

    checkMobile();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
