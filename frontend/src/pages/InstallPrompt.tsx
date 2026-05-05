import { useState, useEffect } from 'react';

interface InstallPromptProps {
  onDismiss: () => void;
}

export default function InstallPrompt({ onDismiss }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    }

    // Capture the Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        onDismiss();
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      {/* Logo */}
      <div style={{ animation: 'float 3s ease-in-out infinite', marginBottom: '24px' }}>
        <img
          src="/monkey-loading.png"
          alt="NotePeel"
          style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(255,193,7,0.3))' }}
        />
      </div>

      {/* Title */}
      <h1 style={{
        margin: '0 0 8px',
        fontSize: '32px',
        fontWeight: 800,
        color: '#FFC107',
        fontFamily: "'Playfair Display', serif",
        textAlign: 'center',
        animation: 'fadeInUp 0.6s ease-out',
      }}>
        NotePeel
      </h1>
      <p style={{
        margin: '0 0 40px',
        fontSize: '15px',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        animation: 'fadeInUp 0.6s ease-out 0.1s backwards',
      }}>
        Peel back the layers of your notes
      </p>

      {/* Install Card */}
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '28px 24px',
        width: '100%',
        maxWidth: '340px',
        border: '1px solid rgba(255,255,255,0.1)',
        animation: 'fadeInUp 0.6s ease-out 0.2s backwards',
      }}>
        <h2 style={{
          margin: '0 0 6px',
          fontSize: '18px',
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
        }}>
          Install NotePeel
        </h2>
        <p style={{
          margin: '0 0 24px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          Add to your home screen for the best experience
        </p>

        {/* Platform-specific instructions */}
        {platform === 'ios' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,193,7,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                1
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Tap the Share button
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  The <span style={{ fontSize: '16px', verticalAlign: 'middle' }}>⬆️</span> icon at the bottom of Safari
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,193,7,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                2
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Scroll down and tap
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  "Add to Home Screen" ➕
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,193,7,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                3
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Tap "Add"
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  Then open NotePeel from your home screen
                </p>
              </div>
            </div>
          </div>
        ) : platform === 'android' && deferredPrompt ? (
          <button
            onClick={handleInstall}
            style={{
              width: '100%',
              padding: '18px',
              background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
              border: 'none',
              borderRadius: '16px',
              fontSize: '17px',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#5D4037',
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 4px 20px rgba(255,193,7,0.3)',
            }}
          >
            Install NotePeel
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,193,7,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                1
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Open browser menu
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  Tap the ⋮ menu in your browser
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'rgba(255,193,7,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                2
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                  Tap "Add to Home Screen"
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  Or "Install App" if available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Skip button */}
      <button
        onClick={onDismiss}
        style={{
          marginTop: '28px',
          padding: '12px 24px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '14px',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          animation: 'fadeInUp 0.6s ease-out 0.3s backwards',
          transition: 'all 0.2s',
        }}
      >
        Continue in browser
      </button>
    </div>
  );
}
