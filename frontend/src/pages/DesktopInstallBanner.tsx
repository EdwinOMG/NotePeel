import { useState, useEffect } from 'react';

export default function DesktopInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Don't show if user dismissed this session
    if (sessionStorage.getItem('desktopInstallDismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('desktopInstallDismissed', 'true');
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '14px',
      position: 'relative',
      zIndex: 999,
      boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes bannerSlideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      `}</style>

      <img
        src="/monkey-loading.png"
        alt="NotePeel"
        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
      />

      <span style={{ color: '#5D4037', fontWeight: 500 }}>
        Get the NotePeel desktop app for a better experience
      </span>

      <button
        onClick={handleInstall}
        style={{
          padding: '6px 16px',
          background: '#5D4037',
          color: '#FFC107',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Install
      </button>

      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          right: '12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#5D4037',
          opacity: 0.5,
          padding: '4px 8px',
          lineHeight: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
      >
        ✕
      </button>
    </div>
  );
}
