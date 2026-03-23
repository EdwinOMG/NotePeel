import { useState, useEffect, useRef, useCallback } from 'react';
import { authAPI } from '../services/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, config: { theme?: string; size?: string; width?: number; text?: string }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface RegisterProps {
  onRegister: (token: string, email: string) => void;
  onSwitchToLogin: () => void;
}

export default function Register({ onRegister, onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError('');
    setLoading(true);
    try {
      const result = await authAPI.googleLogin(response.credential);
      localStorage.setItem('token', result.access_token);
      const me = await authAPI.getMe();
      onRegister(result.access_token, me.email);
    } catch (err) {
      localStorage.removeItem('token');
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    } finally {
      setLoading(false);
    }
  }, [onRegister]);

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
        text: 'signup_with',
      });
    }
  }, [handleGoogleResponse]);

  useEffect(() => {
    if (window.google) {
      initGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initGoogleSignIn();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [initGoogleSignIn]);

  const handleSubmit = async () => {
    if (!email || !username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await authAPI.register({ email, username, password });
      const loginResponse = await authAPI.login({ email, password });
      onRegister(loginResponse.access_token, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>🐵🍌</div>
          <h1 style={{ margin: '0 0 5px', color: '#5D4037' }}>NotePeel</h1>
          <p style={{ color: '#8D6E63', margin: 0 }}>Join the troop!</p>
        </div>
        
        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '6px', marginBottom: '20px' }}>
            {error}
          </div>
        )}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '2px solid #FFE082', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
        />
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '2px solid #FFE082', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '2px solid #FFE082', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }}
        />
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
            color: '#5D4037',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Creating account...' : '🐵 Create Account'}
        </button>
        
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: '#FFE082' }} />
              <span style={{ color: '#8D6E63', fontSize: '13px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#FFE082' }} />
            </div>
            <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }} />
          </>
        )}

        <p style={{ textAlign: 'center', margin: 0, color: '#8D6E63' }}>
          Already have an account?{' '}
          <span onClick={onSwitchToLogin} style={{ color: '#FF9800', cursor: 'pointer', fontWeight: 'bold' }}>
            Sign In
          </span>
        </p>
      </div>
    </div>
  );
}
