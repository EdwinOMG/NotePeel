import { useState, useEffect, useRef, useCallback } from 'react';
import { authAPI } from '../services/api';
import * as msal from '@azure/msal-browser';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, config: { theme?: string; size?: string; width?: number; text?: string; shape?: string }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';

// Initialize MSAL instance for Microsoft login
let msalInstance: msal.PublicClientApplication | null = null;
if (MICROSOFT_CLIENT_ID) {
  const msalConfig: msal.Configuration = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  };
  msalInstance = new msal.PublicClientApplication(msalConfig);
}

interface LoginProps {
  onLogin: (token: string, email: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [msalReady, setMsalReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Initialize MSAL
  useEffect(() => {
    if (msalInstance) {
      msalInstance.initialize().then(() => {
        setMsalReady(true);
      }).catch((err) => {
        console.error('MSAL init failed:', err);
      });
    }
  }, []);

  // ── Google Sign-In ──────────────────────────────────────────────

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.googleLogin(response.credential);
      localStorage.setItem('token', result.access_token);
      const me = await authAPI.getMe();
      onLogin(result.access_token, me.email);
    } catch (err) {
      localStorage.removeItem('token');
      setError(err instanceof Error ? err.message : 'Google sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onLogin]);

  const initGoogleSignIn = useCallback(() => {
    if (GOOGLE_CLIENT_ID && window.google && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill',
      });
      setGoogleReady(true);
    }
  }, [handleGoogleResponse]);

  useEffect(() => {
    // Check for session expired
    const sessionExpired = sessionStorage.getItem('sessionExpired');
    if (sessionExpired) {
      setError('Your session has expired. Please sign in again.');
      sessionStorage.removeItem('sessionExpired');
    }

    if (window.google) {
      initGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initGoogleSignIn();
          clearInterval(interval);
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [initGoogleSignIn]);

  // ── Microsoft Sign-In (MSAL popup) ─────────────────────────────

  const handleMicrosoftLogin = async () => {
    if (!msalInstance || !msalReady) return;

    setError('');
    setLoading(true);

    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
      });

      const account = loginResponse.account;
      if (!account) {
        throw new Error('No account returned from Microsoft');
      }

      // Send user info to our backend
      const result = await authAPI.microsoftLogin(
        account.localAccountId,
        account.username, // email
        account.name || account.username.split('@')[0]
      );

      localStorage.setItem('token', result.access_token);
      const me = await authAPI.getMe();
      onLogin(result.access_token, me.email);
    } catch (err) {
      localStorage.removeItem('token');
      if (err instanceof msal.BrowserAuthError && err.errorCode === 'user_cancelled') {
        // User closed the popup, don't show error
        setLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Microsoft sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  const hasAnyProvider = GOOGLE_CLIENT_ID || MICROSOFT_CLIENT_ID;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <img
            src="/monkey-loading.png"
            alt="NotePeel"
            style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '10px' }}
          />
          <h1 style={{ margin: '0 0 5px', color: '#5D4037' }}>NotePeel</h1>
          <p style={{ color: '#8D6E63', margin: 0 }}>Peel back the layers of your notes</p>
        </div>

        {error && (
          <div style={{
            background: error.includes('expired') ? '#FFF3E0' : '#ffebee',
            color: error.includes('expired') ? '#E65100' : '#c62828',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{
            padding: '20px',
            color: '#8D6E63',
            fontSize: '15px'
          }}>
            Signing you in...
          </div>
        )}

        {!hasAnyProvider ? (
          <div style={{
            background: '#FFF3E0',
            color: '#E65100',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            No sign-in providers are configured. Please set <code>VITE_GOOGLE_CLIENT_ID</code> or <code>VITE_MICROSOFT_CLIENT_ID</code> environment variables.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {/* Google Sign-In */}
            {GOOGLE_CLIENT_ID && (
              <>
                {!googleReady && !error && (
                  <div style={{ padding: '10px', color: '#8D6E63', fontSize: '14px' }}>
                    Loading Google Sign-In...
                  </div>
                )}
                <div
                  ref={googleButtonRef}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    minHeight: '44px'
                  }}
                />
              </>
            )}

            {/* Divider between providers */}
            {GOOGLE_CLIENT_ID && MICROSOFT_CLIENT_ID && (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#E0E0E0' }} />
                <span style={{ color: '#9E9E9E', fontSize: '13px' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: '#E0E0E0' }} />
              </div>
            )}

            {/* Microsoft Sign-In */}
            {MICROSOFT_CLIENT_ID && (
              <button
                onClick={handleMicrosoftLogin}
                disabled={loading || !msalReady}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '320px',
                  maxWidth: '100%',
                  padding: '10px 24px',
                  background: 'white',
                  border: '1px solid #D1D5DB',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#3C4043',
                  cursor: loading || !msalReady ? 'not-allowed' : 'pointer',
                  opacity: loading || !msalReady ? 0.6 : 1,
                  fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!loading && msalReady) {
                    e.currentTarget.style.background = '#F8F9FA';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                </svg>
                Continue with Microsoft
              </button>
            )}
          </div>
        )}

        <p style={{
          color: '#BDBDBD',
          fontSize: '12px',
          margin: '24px 0 0',
          lineHeight: '1.5'
        }}>
          By signing in, you agree to let NotePeel access your account email and profile info.
        </p>
      </div>
    </div>
  );
}
