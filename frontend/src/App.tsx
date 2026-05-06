import { useState, useEffect } from 'react';
import { useIsMobile } from './hooks/useIsMobile';
import Login from './pages/Login';
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
import PlansPage from './pages/PlansPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';

type Page = 
  | { type: 'login' }
  | { type: 'notebooks' }
  | { type: 'notebook'; notebookId: number }
  | { type: 'editor'; noteId: number; notebookId?: number }
  | { type: 'settings' }
  | { type: 'mobileNote'; noteId: number }
  | { type: 'plans' }
  | { type: 'privacy' }
  | { type: 'terms' }
  | { type: 'contact' };

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>({ type: 'login' });
  const [darkMode, setDarkMode] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const isMobile = useIsMobile();

  // Track the page the user was on before navigating to a legal/plans page
  const [previousPage, setPreviousPage] = useState<Page | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('userEmail');
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (token && email) {
      setIsAuthenticated(true);
      setUserEmail(email);

      // Check if returning from Stripe checkout or portal
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') || params.get('page') === 'plans') {
        // Go straight to PlansPage so its sync logic can fire
        setPreviousPage({ type: 'notebooks' });
        setCurrentPage({ type: 'plans' });
      } else {
        setCurrentPage({ type: 'notebooks' });
      }
    }
    
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    
    const isIPad = navigator.platform === 'iPad' || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isStandalone && (isIPad || /android|iphone|ipod/i.test(navigator.userAgent))) {
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

  // Navigate to plans/legal pages while remembering where to go back
  const navigateWithReturn = (target: Page) => {
    setPreviousPage(currentPage);
    setCurrentPage(target);
  };

  const goBackFromOverlay = () => {
    if (previousPage) {
      setCurrentPage(previousPage);
      setPreviousPage(null);
    } else if (isAuthenticated) {
      setCurrentPage({ type: 'settings' });
    } else {
      setCurrentPage({ type: 'login' });
    }
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

  // ─── LEGAL / PLANS PAGES (available whether logged in or not) ──
  if (currentPage.type === 'plans') {
    return (
      <PlansPage
        userEmail={userEmail}
        onBack={goBackFromOverlay}
        darkMode={darkMode}
        isMobile={isMobile}
      />
    );
  }

  if (currentPage.type === 'privacy') {
    return (
      <PrivacyPolicyPage
        onBack={goBackFromOverlay}
        darkMode={darkMode}
        isMobile={isMobile}
      />
    );
  }

  if (currentPage.type === 'terms') {
    return (
      <TermsPage
        onBack={goBackFromOverlay}
        darkMode={darkMode}
        isMobile={isMobile}
      />
    );
  }

  if (currentPage.type === 'contact') {
    return (
      <ContactPage
        userEmail={userEmail}
        onBack={goBackFromOverlay}
        darkMode={darkMode}
        isMobile={isMobile}
      />
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={handleLogin}
        onNavigate={(page: string) => navigateWithReturn({ type: page as any })}
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
            onNavigate={(page: string) => navigateWithReturn({ type: page as any })}
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

  // ─── DESKTOP ROUTING ─────────────────────────────────────────
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
          onNavigate={(page: string) => navigateWithReturn({ type: page as any })}
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
