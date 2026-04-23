import { useState, useEffect } from 'react';
import { useIsMobile } from './hooks/useIsMobile';
import Login from './pages/Login';
import Register from './pages/Register';
import NotebooksPage from './pages/NotebooksPage';
import NotebookView from './pages/NotebookView';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';
import MobileHome from './pages/MobileHome';
import MobileNotebookView from './pages/MobileNotebookView';
import MobileNoteViewer from './pages/MobileNoteViewer';
import MobileSettings from './pages/MobileSettings';
import InstallPrompt from './pages/InstallPrompt';
import DesktopInstallBanner from './pages/DesktopInstallBanner';

type Page = 
  | { type: 'login' }
  | { type: 'register' }
  | { type: 'notebooks' }
  | { type: 'notebook'; notebookId: number }
  | { type: 'editor'; noteId: number; notebookId?: number }
  | { type: 'settings' }
  | { type: 'mobileNote'; noteId: number };

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>({ type: 'login' });
  const [darkMode, setDarkMode] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
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

    // Show install prompt on mobile if not already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    
    if (!isStandalone && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setShowInstallPrompt(true);
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

  // Show install prompt on mobile before anything else
  if (showInstallPrompt && isMobile) {
    return (
      <InstallPrompt
        onDismiss={() => {
          setShowInstallPrompt(false);
        }}
      />
    );
  }

  // Not authenticated - show login/register (same for both mobile and desktop)
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

  // ─── MOBILE ROUTING ───────────────────────────────────────────
  if (isMobile) {
    switch (currentPage.type) {
      case 'notebooks':
        return (
          <MobileHome
            userEmail={userEmail}
            onLogout={handleLogout}
            onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
            onOpenSettings={() => setCurrentPage({ type: 'settings' })}
            darkMode={darkMode}
          />
        );

      case 'notebook':
        return (
          <MobileNotebookView
            notebookId={currentPage.notebookId}
            onBack={() => setCurrentPage({ type: 'notebooks' })}
            onOpenNote={(noteId) => setCurrentPage({ type: 'mobileNote', noteId })}
            darkMode={darkMode}
          />
        );

      case 'mobileNote':
        return (
          <MobileNoteViewer
            noteId={currentPage.noteId}
            onBack={() => setCurrentPage({ type: 'notebooks' })}
            darkMode={darkMode}
          />
        );

      // If on mobile and somehow on 'editor' page, show read-only viewer instead
      case 'editor':
        return currentPage.noteId > 0 ? (
          <MobileNoteViewer
            noteId={currentPage.noteId}
            onBack={() => {
              if (currentPage.notebookId) {
                setCurrentPage({ type: 'notebook', notebookId: currentPage.notebookId });
              } else {
                setCurrentPage({ type: 'notebooks' });
              }
            }}
            darkMode={darkMode}
          />
        ) : (
          <MobileHome
            userEmail={userEmail}
            onLogout={handleLogout}
            onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
            onOpenSettings={() => setCurrentPage({ type: 'settings' })}
            darkMode={darkMode}
          />
        );

      case 'settings':
        return (
          <MobileSettings
            userEmail={userEmail}
            onBack={() => setCurrentPage({ type: 'notebooks' })}
            onLogout={handleLogout}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        );

      default:
        return (
          <MobileHome
            userEmail={userEmail}
            onLogout={handleLogout}
            onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
            onOpenSettings={() => setCurrentPage({ type: 'settings' })}
            darkMode={darkMode}
          />
        );
    }
  }

  // ─── DESKTOP ROUTING (unchanged) ─────────────────────────────
  
  // Wrap desktop pages with the install banner
  const withBanner = (page: React.ReactNode) => (
    <>
      <DesktopInstallBanner />
      {page}
    </>
  );

  switch (currentPage.type) {
    case 'notebooks':
      return withBanner(
        <NotebooksPage
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenNotebook={(notebookId) => setCurrentPage({ type: 'notebook', notebookId })}
          onOpenSettings={() => setCurrentPage({ type: 'settings' })}
          darkMode={darkMode}
        />
      );

    case 'notebook':
      return withBanner(
        <NotebookView
          notebookId={currentPage.notebookId}
          onBack={() => setCurrentPage({ type: 'notebooks' })}
          onOpenNote={(noteId, notebookId) => setCurrentPage({ type: 'editor', noteId, notebookId })}
          onCreateNote={(notebookId) => setCurrentPage({ type: 'editor', noteId: 0, notebookId })}
          darkMode={darkMode}
        />
      );

    case 'editor':
      return withBanner(
        <Dashboard
          userEmail={userEmail}
          onLogout={handleLogout}
          initialNoteId={currentPage.noteId > 0 ? currentPage.noteId : undefined}
          notebookId={currentPage.notebookId}
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
      return withBanner(
        <SettingsPage
          userEmail={userEmail}
          onBack={() => setCurrentPage({ type: 'notebooks' })}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      );

    default:
      return withBanner(
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
