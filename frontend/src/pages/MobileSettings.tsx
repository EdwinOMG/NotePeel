import { useState } from 'react';

interface MobileSettingsProps {
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function MobileSettings({ userEmail, onBack, onLogout, darkMode, onToggleDarkMode }: MobileSettingsProps) {

  const theme = {
    bg: darkMode ? '#1a1a2e' : '#FFF8E1',
    cardBg: darkMode ? '#252542' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#5D4037',
    textSecondary: darkMode ? '#a1a1aa' : '#8D6E63',
    border: darkMode ? '#3f3f5a' : '#E0E0E0',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{
        background: theme.headerBg,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '10px',
              padding: '8px 14px', fontSize: '16px', cursor: 'pointer',
              color: darkMode ? '#e4e4e7' : '#5D4037', fontWeight: 600,
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: darkMode ? '#e4e4e7' : '#5D4037', fontFamily: "'Inter', sans-serif" }}>
            ⚙️ Settings
          </h1>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 16px' }}>
        {/* Account Section */}
        <div style={{
          background: theme.cardBg, borderRadius: '16px', overflow: 'hidden',
          border: `1px solid ${theme.border}`, marginBottom: '16px',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>
              Account
            </h3>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>Email</p>
            <p style={{ margin: 0, fontSize: '15px', color: theme.text, fontWeight: 500, fontFamily: "'Inter', sans-serif", wordBreak: 'break-all' }}>{userEmail}</p>
          </div>
        </div>

        {/* Appearance Section */}
        <div style={{
          background: theme.cardBg, borderRadius: '16px', overflow: 'hidden',
          border: `1px solid ${theme.border}`, marginBottom: '16px',
          animation: 'fadeIn 0.3s ease-out', animationDelay: '0.05s',
        }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>
              Appearance
            </h3>
          </div>
          <div
            onClick={onToggleDarkMode}
            style={{
              padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '15px', color: theme.text, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                {darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                {darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              </p>
            </div>
            {/* Toggle */}
            <div style={{
              width: '52px', height: '30px', borderRadius: '15px',
              background: darkMode ? '#FFC107' : '#d1d5db',
              padding: '3px', cursor: 'pointer', transition: 'background 0.3s',
              display: 'flex', alignItems: darkMode ? undefined : undefined,
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '12px', background: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'transform 0.3s',
                transform: darkMode ? 'translateX(22px)' : 'translateX(0)',
              }} />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div style={{
          background: theme.cardBg, borderRadius: '16px', overflow: 'hidden',
          border: `1px solid ${theme.border}`, marginBottom: '16px',
          animation: 'fadeIn 0.3s ease-out', animationDelay: '0.1s',
        }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>
              About
            </h3>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <img src="/monkey-loading.png" alt="NotePeel" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
              <div>
                <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: theme.text, fontFamily: "'Playfair Display', serif" }}>NotePeel</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>Mobile Version</p>
              </div>
            </div>
            <div style={{
              background: darkMode ? '#2a2a40' : '#FFF3E0', borderRadius: '12px', padding: '12px',
              fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5', fontFamily: "'Inter', sans-serif",
            }}>
              📱 Upload & view notes on mobile. Open on desktop for the full editor with formatting tools.
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: '16px', background: darkMode ? 'rgba(198,40,40,0.15)' : '#FFEBEE',
            border: `1px solid ${darkMode ? 'rgba(198,40,40,0.3)' : '#FFCDD2'}`,
            borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
            color: '#C62828', fontFamily: "'Inter', sans-serif",
            animation: 'fadeIn 0.3s ease-out', animationDelay: '0.15s',
          }}
        >
          🚪 Log Out
        </button>
      </div>
    </div>
  );
}
