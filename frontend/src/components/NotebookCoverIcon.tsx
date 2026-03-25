import { useId } from 'react';
import type { CSSProperties } from 'react';

interface NotebookCoverIconProps {
  color: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}

export default function NotebookCoverIcon({
  color,
  width = 80,
  height = 85,
  style,
}: NotebookCoverIconProps) {
  const idBase = useId().replace(/:/g, '');
  const marbleTextureId = `${idBase}-marble-texture`;
  const marbleGrainId = `${idBase}-marble-grain`;
  const coverSheenId = `${idBase}-cover-sheen`;
  const topEdgeLightId = `${idBase}-top-edge-light`;
  const pageRightId = `${idBase}-page-right`;
  const pageBottomId = `${idBase}-page-bottom`;
  const coverClipId = `${idBase}-cover-clip`;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 135"
      style={{
        filter: 'drop-shadow(2px 5px 8px rgba(0,0,0,0.35)), drop-shadow(0 2px 3px rgba(0,0,0,0.2))',
        ...style,
      }}
    >
      <defs>
        <filter id={marbleTextureId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.06" numOctaves="4" seed="3" result="noise" />
          <feTurbulence type="turbulence" baseFrequency="0.02 0.08" numOctaves="3" seed="7" result="veins" />
          <feMerge result="combined">
            <feMergeNode in="noise" />
            <feMergeNode in="veins" />
          </feMerge>
          <feComponentTransfer result="contrast">
            <feFuncR type="linear" slope="1.8" intercept="-0.3" />
            <feFuncG type="linear" slope="1.8" intercept="-0.3" />
            <feFuncB type="linear" slope="1.8" intercept="-0.3" />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values="0" result="gray" />
        </filter>
        <filter id={marbleGrainId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.15 0.12" numOctaves="6" seed="12" result="grain" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="2" intercept="-0.4" />
            <feFuncG type="linear" slope="2" intercept="-0.4" />
            <feFuncB type="linear" slope="2" intercept="-0.4" />
          </feComponentTransfer>
        </filter>
        <linearGradient id={coverSheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="25%" stopColor="white" stopOpacity="0.06" />
          <stop offset="60%" stopColor="black" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={topEdgeLightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={pageRightId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f5f0e8" />
          <stop offset="40%" stopColor="#ebe5d9" />
          <stop offset="100%" stopColor="#d8d2c6" />
        </linearGradient>
        <linearGradient id={pageBottomId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0ebe0" />
          <stop offset="100%" stopColor="#d4cfc5" />
        </linearGradient>
        <clipPath id={coverClipId}>
          <rect x="20" y="6" width="74" height="112" rx="3" />
        </clipPath>
      </defs>

      <g transform="skewY(-1) rotate(-1.5, 60, 65)">
        <rect x="27" y="10" width="74" height="112" rx="3" fill={color} opacity="0.4" />
        <rect x="27" y="10" width="74" height="112" rx="3" fill="rgba(0,0,0,0.15)" />

        <rect x="95" y="10" width="5.5" height="108" rx="0.5" fill={`url(#${pageRightId})`} />
        <line x1="95.5" y1="13" x2="95.5" y2="115" stroke="#d8d2c6" strokeWidth="0.25" />
        <line x1="96.3" y1="12" x2="96.3" y2="116" stroke="#cec8bc" strokeWidth="0.25" />
        <line x1="97.1" y1="11.5" x2="97.1" y2="116.5" stroke="#c8c2b6" strokeWidth="0.25" />
        <line x1="97.9" y1="11" x2="97.9" y2="117" stroke="#c2bcb0" strokeWidth="0.25" />
        <line x1="98.7" y1="10.5" x2="98.7" y2="117.5" stroke="#bcb6aa" strokeWidth="0.25" />
        <line x1="99.5" y1="10" x2="99.5" y2="118" stroke="#b6b0a4" strokeWidth="0.3" />
        <rect x="95" y="10" width="2" height="108" rx="0.3" fill="white" opacity="0.08" />

        <rect x="25" y="116" width="70.5" height="5.5" rx="0.5" fill={`url(#${pageBottomId})`} />
        <line x1="27" y1="116.5" x2="95" y2="116.5" stroke="#d8d2c6" strokeWidth="0.25" />
        <line x1="26.5" y1="117.3" x2="95.5" y2="117.3" stroke="#cec8bc" strokeWidth="0.25" />
        <line x1="26" y1="118.1" x2="96" y2="118.1" stroke="#c8c2b6" strokeWidth="0.25" />
        <line x1="26" y1="118.9" x2="96.5" y2="118.9" stroke="#c2bcb0" strokeWidth="0.25" />
        <line x1="26.5" y1="119.7" x2="97" y2="119.7" stroke="#bcb6aa" strokeWidth="0.25" />
        <line x1="27" y1="120.5" x2="97.5" y2="120.5" stroke="#b6b0a4" strokeWidth="0.3" />
        <rect x="25" y="116" width="70.5" height="1.5" rx="0.3" fill="white" opacity="0.06" />

        <path d="M95.5 116 L100.5 118 L97.5 121 L95.5 119 Z" fill="#ccc7bc" />

        <rect x="20" y="6" width="74" height="112" rx="3" fill={color} />
        <g clipPath={`url(#${coverClipId})`}>
          <rect x="20" y="6" width="74" height="112" filter={`url(#${marbleTextureId})`} opacity="0.25" style={{ mixBlendMode: 'overlay' }} />
          <rect x="20" y="6" width="74" height="112" filter={`url(#${marbleGrainId})`} opacity="0.15" style={{ mixBlendMode: 'multiply' }} />
        </g>
        <rect x="20" y="6" width="74" height="112" rx="3" fill={`url(#${coverSheenId})`} />
        <rect x="20" y="6" width="74" height="20" rx="3" fill={`url(#${topEdgeLightId})`} />
        <rect x="20" y="6" width="74" height="112" rx="3" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />

        <rect x="20" y="6" width="10" height="112" rx="2" fill="rgba(0,0,0,0.22)" />
        <rect x="20" y="6" width="4" height="112" rx="1" fill="rgba(255,255,255,0.1)" />
        <line x1="20.8" y1="9" x2="20.8" y2="115" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
        <line x1="30" y1="6" x2="30" y2="118" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />

        <rect x="37" y="35" width="48" height="34" rx="2.5" fill="rgba(0,0,0,0.08)" />
        <rect x="37" y="35" width="48" height="34" rx="2.5" fill={color} />
        <rect x="37" y="35" width="48" height="34" rx="2.5" fill="white" opacity="0.82" />
        <rect x="37" y="35" width="48" height="34" rx="2.5" fill={color} opacity="0.08" />
        <line x1="38" y1="35.5" x2="84.5" y2="35.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.6" />
        <line x1="37.3" y1="36" x2="37.3" y2="68.5" stroke="rgba(0,0,0,0.07)" strokeWidth="0.5" />
        <line x1="38" y1="68.7" x2="84.5" y2="68.7" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <line x1="84.7" y1="36" x2="84.7" y2="68.5" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
        <rect x="39.5" y="37.5" width="43" height="29" rx="1.5" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.4" />
        <line x1="42" y1="44" x2="80" y2="44" stroke={color} strokeWidth="0.45" opacity="0.2" />
        <line x1="42" y1="49" x2="80" y2="49" stroke={color} strokeWidth="0.45" opacity="0.2" />
        <line x1="42" y1="54" x2="80" y2="54" stroke={color} strokeWidth="0.45" opacity="0.2" />
        <line x1="42" y1="59" x2="80" y2="59" stroke={color} strokeWidth="0.45" opacity="0.2" />
        <line x1="42" y1="64" x2="65" y2="64" stroke={color} strokeWidth="0.45" opacity="0.18" />
        <line x1="46" y1="37.5" x2="46" y2="67" stroke="#cc4444" strokeWidth="0.4" opacity="0.2" />

        <path d="M23 6 Q20 6 20 9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
        <path d="M91 6 Q94 6 94 9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />

        <path d="M20 118 L94 118 L96 121 L22 121 Z" fill="rgba(0,0,0,0.1)" />
        <path d="M20 118 L94 118 L95 119.5 L21 119.5 Z" fill={color} opacity="0.6" />
        <path d="M94 6 L96 8 L96 121 L94 118 Z" fill="rgba(0,0,0,0.06)" />
        <path d="M94 6 L95 7 L95 119.5 L94 118 Z" fill={color} opacity="0.4" />

        <line x1="35" y1="78" x2="42" y2="77" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        <line x1="60" y1="95" x2="68" y2="94.5" stroke="rgba(255,255,255,0.03)" strokeWidth="0.6" />
        <line x1="75" y1="22" x2="82" y2="21" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      </g>
    </svg>
  );
}
