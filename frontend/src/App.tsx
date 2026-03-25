import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import NotebooksPage from './pages/NotebooksPage';
import NotebookView from './pages/NotebookView';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';
import SharedNotePage from './pages/SharedNotePage';

type Page =
  | { type: 'login' }
  | { type: 'register' }
  | { type: 'notebooks' }
  | { type: 'notebook'; notebookId: number }
  | { type: 'editor'; noteId: number; notebookId?: number; notebookColor?: string }
  | { type: 'settings' }
  | { type: 'shared'; token: string };

function App() {
  // Handle /shared/{token} URL before anything else
  const sharedMatch = window.location.pathname.match(/^\/shared\/([a-f0-9-]+)$/i);
  if (sharedMatch) {
    return <SharedNotePage token={sharedMatch[1]} />;
  }
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>({ type: 'login' });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('userEmail');
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (token && email) {
      setIsAuthenticated(true);
      setUserEmail(email);
      setCurrentPage({ type: 'notebooks' });
    }
    
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  const handleLogin = (token: string, email: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    setIsAuthenticated(true);
    setUserEmail(email);
    setCurrentPage({ type: 'notebooks' });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);
    setUserEmail('');
    setCurrentPage({ type: 'login' });
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
  };

  // Not authenticated - show login/register
  if (!isAuthenticated) {
    if (currentPage.type === 'register') {
      return (
        <Register
          onRegister={handleLogin}
          onSwitchToLogin={() => setCurrentPage({ type: 'login' })}
        />
      );
    }
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setCurrentPage({ type: 'register' })}
      />
    );
  }

  // Authenticated - show appropriate page
  switch (currentPage.type) {
    case 'notebooks':
      return (
        <NotebooksPage
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
          onOpenSettings={() => setCurrentPage({ type: 'settings' })}
          darkMode={darkMode}
        />
      );

    case 'notebook':
      return (
        <NotebookView
          notebookId={currentPage.notebookId}
          userEmail={userEmail}
          onBack={() => setCurrentPage({ type: 'notebooks' })}
          onOpenNote={(noteId, notebookId, notebookColor) => setCurrentPage({ type: 'editor', noteId, notebookId, notebookColor })}
          onCreateNote={(notebookId) => setCurrentPage({ type: 'editor', noteId: 0, notebookId })}
          onOpenSettings={() => setCurrentPage({ type: 'settings' })}
          onLogout={handleLogout}
          darkMode={darkMode}
        />
      );

    case 'editor':
      return (
        <Dashboard
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenSettings={() => setCurrentPage({ type: 'settings' })}
          initialNoteId={currentPage.noteId > 0 ? currentPage.noteId : undefined}
          notebookId={currentPage.notebookId}
          notebookColor={currentPage.notebookColor}
          onBack={() => {
            if (currentPage.notebookId) {
              setCurrentPage({ type: 'notebook', notebookId: currentPage.notebookId });
            } else {
              setCurrentPage({ type: 'notebooks' });
            }
          }}
          darkMode={darkMode}
        />
      );

    case 'settings':
      return (
        <SettingsPage
          userEmail={userEmail}
          onBack={() => setCurrentPage({ type: 'notebooks' })}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      );

    default:
      return (
        <NotebooksPage
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
          onOpenSettings={() => setCurrentPage({ type: 'settings' })}
          darkMode={darkMode}
        />
      );
  }
}

export default App;
