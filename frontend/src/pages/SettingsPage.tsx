import { useState } from 'react';
import ProfileMenu from '../components/ProfileMenu';

interface SettingsPageProps {
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function SettingsPage({ 
  userEmail, 
  onBack, 
  onLogout, 
  darkMode, 
  onToggleDarkMode 
}: SettingsPageProps) {
  const [message, setMessage] = useState('');

  // Theme colors
  const theme = {
    bg: darkMode ? '#1C1917' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#292524' : '#ffffff',
    headerBg: darkMode ? 'linear-gradient(135deg, #6C4B14 0%, #5A400F 100%)' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
    text: darkMode ? '#F5F0E8' : '#1a1a2e',
    textSecondary: darkMode ? '#A8A29E' : '#6b7280',
    border: darkMode ? '#44403C' : '#e5e7eb',
    accent: '#FFC107',
    accentHover: '#FFB300',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      transition: 'background 0.3s ease'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .settings-card {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      {/* Header */}
      <header style={{
        background: theme.headerBg,
        borderBottom: darkMode ? '1px solid rgba(0,0,0,0.25)' : '1px solid #F9A825',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(255, 193, 7, 0.3)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '14px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '8px 16px',
                background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                color: darkMode ? '#F5F0E8' : '#5D4037',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              ← Back
            </button>
            <span style={{ fontSize: '36px' }}>🐵🍌</span>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: darkMode ? '#F5F0E8' : '#5D4037',
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: '-0.02em'
            }}>
              NotePeel
            </h1>
          </div>

          <ProfileMenu
            userEmail={userEmail}
            onLogout={onLogout}
            darkMode={darkMode}
          />
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
          color: '#5D4037',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: 500
        }}>
          <span>🐵</span>
          <span>{message}</span>
        </div>
      )}

      {/* Main Content */}
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 32px'
      }}>
        <h2 style={{
          margin: '0 0 32px',
          fontSize: '32px',
          fontWeight: 700,
          color: theme.text,
          fontFamily: "'Playfair Display', Georgia, serif",
          letterSpacing: '-0.02em'
        }}>
          Settings
        </h2>

        {/* Account Section */}
        <div className="settings-card" style={{
          background: theme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          marginBottom: '24px',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.text
            }}>
              Account
            </h3>
          </div>
          
          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #8D6E63 0%, #5D4037 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: 'white',
                fontWeight: 600
              }}>
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.text
                }}>
                  {userEmail}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: theme.textSecondary
                }}>
                  Logged in
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="settings-card" style={{
          background: theme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          marginBottom: '24px',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          animationDelay: '0.1s'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.text
            }}>
              Appearance
            </h3>
          </div>
          
          <div style={{ padding: '24px' }}>
            {/* Dark Mode Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: theme.text
                }}>
                  Dark Mode
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: theme.textSecondary
                }}>
                  Switch to a darker color scheme
                </p>
              </div>
              
              {/* Toggle Switch */}
              <button
                onClick={() => {
                  onToggleDarkMode();
                  setMessage(darkMode ? 'Light mode enabled' : 'Dark mode enabled');
                  setTimeout(() => setMessage(''), 2000);
                }}
                style={{
                  width: '52px',
                  height: '28px',
                  borderRadius: '14px',
                  border: 'none',
                  background: darkMode ? '#FFC107' : '#e5e7eb',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.3s ease'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: darkMode ? '27px' : '3px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'left 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px'
                }}>
                  {darkMode ? '🌙' : '☀️'}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="settings-card" style={{
          background: theme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          animationDelay: '0.2s'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.text
            }}>
              About
            </h3>
          </div>
          
          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '32px' }}>🐵🍌</span>
              <div>
                <p style={{
                  margin: '0 0 2px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: theme.text,
                  fontFamily: "'Playfair Display', Georgia, serif"
                }}>
                  NotePeel
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: theme.textSecondary
                }}>
                  Version 2.0.0
                </p>
              </div>
            </div>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: theme.textSecondary,
              lineHeight: 1.6
            }}>
              Peel back the layers of your handwritten notes with AI-powered transcription and organization.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-card" style={{
          background: theme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${darkMode ? '#5c3a3a' : '#fecaca'}`,
          marginTop: '24px',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          animationDelay: '0.3s'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${darkMode ? '#5c3a3a' : '#fecaca'}`,
            background: darkMode ? 'rgba(220, 38, 38, 0.1)' : '#fef2f2'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#dc2626'
            }}>
              Danger Zone
            </h3>
          </div>
          
          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: theme.text
                }}>
                  Sign Out
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: theme.textSecondary
                }}>
                  Sign out of your account on this device
                </p>
              </div>
              
              <button
                onClick={onLogout}
                style={{
                  padding: '10px 20px',
                  background: darkMode ? 'rgba(220, 38, 38, 0.2)' : '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#dc2626',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dc2626';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = darkMode ? 'rgba(220, 38, 38, 0.2)' : '#fef2f2';
                  e.currentTarget.style.color = '#dc2626';
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
