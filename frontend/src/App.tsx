import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

type Page = 'login' | 'register' | 'dashboard';

function App() {
  const [page, setPage] = useState<Page>('login');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedEmail = localStorage.getItem('userEmail');
    
    if (token && savedEmail) {
      setUserEmail(savedEmail);
      setPage('dashboard');
    }
  }, []);

  const handleLogin = (token: string, email: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    setPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setUserEmail('');
    setPage('login');
  };

  if (page === 'login') {
    return <Login onLogin={handleLogin} onSwitchToRegister={() => setPage('register')} />;
  }

  if (page === 'register') {
    return <Register onRegister={handleLogin} onSwitchToLogin={() => setPage('login')} />;
  }

  return <Dashboard userEmail={userEmail} onLogout={handleLogout} />;
}

export default App;
