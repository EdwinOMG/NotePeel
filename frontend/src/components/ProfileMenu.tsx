import { useState, useEffect, useRef } from 'react';

interface ProfileMenuProps {
  userEmail: string;
  onLogout: () => void;
  darkMode: boolean;
  /** If omitted, Settings item renders as "current page" (non-clickable) */
  onOpenSettings?: () => void;
  /** Use 'hero' on colored notebook headers */
  variant?: 'default' | 'hero';
  /** Contrast text color for the hero header background */
  heroTextColor?: string;
  /** Hide the email label next to the avatar (useful in compact headers) */
  showEmail?: boolean;
}

export default function ProfileMenu({
  userEmail,
  onLogout,
  darkMode,
  onOpenSettings,
  variant = 'default',
  heroTextColor = '#ffffff',
  showEmail = true,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isHero = variant === 'hero';
  const textColor = isHero ? heroTextColor : (darkMode ? '#F5F0E8' : '#5D4037');
  const dropdownBg = darkMode ? '#292524' : '#ffffff';
  const dropdownBorder = darkMode ? '#44403C' : '#e5e7eb';
  const dropdownText = darkMode ? '#F5F0E8' : '#1a1a1a';
  const dropdownTextSecondary = darkMode ? '#A8A29E' : '#6b7280';
  const dropdownHover = darkMode ? '#3C3836' : '#f5f5f5';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px 6px 6px',
          background: isHero
            ? 'rgba(255,255,255,0.18)'
            : (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)'),
          border: isHero ? '1px solid rgba(255,255,255,0.3)' : 'none',
          borderRadius: '24px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isHero ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
          backdropFilter: isHero ? 'blur(4px)' : 'none',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: '28px',
          height: '28px',
          background: isHero
            ? 'rgba(255,255,255,0.3)'
            : 'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: isHero ? heroTextColor : 'white',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {userEmail.charAt(0).toUpperCase()}
        </div>

        {showEmail && (
          <span style={{
            color: textColor,
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '130px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {userEmail}
          </span>
        )}

        <span style={{ color: textColor, fontSize: '9px', opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: dropdownBg,
          border: `1px solid ${dropdownBorder}`,
          borderRadius: '12px',
          boxShadow: darkMode
            ? '0 8px 24px rgba(0,0,0,0.45)'
            : '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: '210px',
          zIndex: 2000,
          overflow: 'hidden',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          {/* Account info */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${dropdownBorder}`,
          }}>
            <div style={{
              fontSize: '11px',
              color: dropdownTextSecondary,
              marginBottom: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Signed in as
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: dropdownText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {userEmail}
            </div>
          </div>

          {/* Settings row */}
          {onOpenSettings ? (
            <button
              onClick={() => { setOpen(false); onOpenSettings(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: dropdownText,
                fontSize: '14px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = dropdownHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '15px' }}>⚙️</span>
              <span>Settings</span>
            </button>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              color: dropdownTextSecondary,
              fontSize: '14px',
            }}>
              <span style={{ fontSize: '15px' }}>⚙️</span>
              <span>Settings</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: '11px',
                background: darkMode ? '#3C3836' : '#f0f0f0',
                color: dropdownTextSecondary,
                padding: '2px 7px',
                borderRadius: '4px',
              }}>
                current
              </span>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${dropdownBorder}` }} />

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              color: '#dc2626',
              fontSize: '14px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(220,38,38,0.1)' : '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: '15px' }}>↪</span>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
