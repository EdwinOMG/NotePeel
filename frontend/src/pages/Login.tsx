import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

interface LoginProps {
  onLogin: (token: string, email: string) => void;
  onSwitchToRegister: () => void;
}

export default function Login({ onLogin, onSwitchToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check for session expired message on mount
  useEffect(() => {
    const sessionExpired = sessionStorage.getItem('sessionExpired');
    if (sessionExpired) {
      setError('Your session has expired. Please log in again.');
      sessionStorage.removeItem('sessionExpired');
    }
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await authAPI.login({ email, password });
      onLogin(response.access_token, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          <p style={{ color: '#8D6E63', margin: 0 }}>Peel back the layers of your notes</p>
        </div>
        
        {error && (
          <div style={{ 
            background: error.includes('expired') ? '#FFF3E0' : '#ffebee', 
            color: error.includes('expired') ? '#E65100' : '#c62828', 
            padding: '10px', 
            borderRadius: '6px', 
            marginBottom: '20px' 
          }}>
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
          {loading ? 'Signing in...' : '🍌 Sign In'}
        </button>
        
        <p style={{ textAlign: 'center', margin: 0, color: '#8D6E63' }}>
          Don't have an account?{' '}
          <span onClick={onSwitchToRegister} style={{ color: '#FF9800', cursor: 'pointer', fontWeight: 'bold' }}>
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
}
