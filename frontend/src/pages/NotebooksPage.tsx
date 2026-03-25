import { useState, useEffect } from 'react';
import { notebooksAPI } from '../services/api';
import NotebookCoverIcon from '../components/NotebookCoverIcon';
import ProfileMenu from '../components/ProfileMenu';
import type { Notebook } from '../types';

interface NotebooksPageProps {
  userEmail: string;
  onLogout: () => void;
  onOpenNotebook: (notebookId: number) => void;
  onOpenSettings: () => void;
  darkMode: boolean;
}

// Refined color palette
const NOTEBOOK_COLORS = [
  '#2C2C2E', // Matte Black
  '#1F2A44', // Deep Navy
  '#2A4C8A', // Deep Sapphire
  '#1A5C6E', // Deep Teal
  '#1E3D2F', // Bottle Green
  '#2D5A3D', // Hunter Green
  '#662222', // Oxblood
  '#B55D3D', // Burnt Sienna
  '#5B3A7E', // Rich Purple
  '#C9A227', // Rich Gold
  '#E8909A', // Soft Rose
  '#F0EBE3', // Warm White
];

export default function NotebooksPage({ userEmail, onLogout, onOpenNotebook, onOpenSettings, darkMode }: NotebooksPageProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookColor, setNewNotebookColor] = useState('#2C2C2E');
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [message, setMessage] = useState('');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Theme colors
  const theme = {
    bg: darkMode ? '#1C1917' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#292524' : '#ffffff',
    text: darkMode ? '#F5F0E8' : '#5D4037',
    textSecondary: darkMode ? '#A8A29E' : '#8D6E63',
    border: darkMode ? '#44403C' : '#E0E0E0',
  };

  useEffect(() => {
    loadNotebooks();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadNotebooks = async () => {
    try {
      const data = await notebooksAPI.getAll();
      setNotebooks(data);
    } catch (err) {
      setMessage('Error loading notebooks: ' + (err instanceof Error ? err.message : 'Failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async () => {
    if (!newNotebookName.trim()) {
      setMessage('Please enter a notebook name');
      return;
    }

    try {
      const notebook = await notebooksAPI.create({
        name: newNotebookName.trim(),
        color: newNotebookColor
      });
      setNotebooks([notebook, ...notebooks]);
      setNewNotebookName('');
      setNewNotebookColor('#2C2C2E');
      setShowCreateModal(false);
      setMessage('Notebook created successfully');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleUpdateNotebook = async () => {
    if (!editingNotebook || !newNotebookName.trim()) return;

    try {
      const updated = await notebooksAPI.update(editingNotebook.id, {
        name: newNotebookName.trim(),
        color: newNotebookColor
      });
      setNotebooks(notebooks.map(n => n.id === updated.id ? updated : n));
      setEditingNotebook(null);
      setNewNotebookName('');
      setNewNotebookColor('#2C2C2E');
      setMessage('Notebook updated');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleDeleteNotebook = async (notebook: Notebook) => {
    if (!confirm(`Delete "${notebook.name}"?`)) return;

    try {
      await notebooksAPI.delete(notebook.id);
      setNotebooks(notebooks.filter(n => n.id !== notebook.id));
      setMessage('Notebook deleted');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const openEditModal = (notebook: Notebook) => {
    setEditingNotebook(notebook);
    setNewNotebookName(notebook.name);
    setNewNotebookColor(notebook.color);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      transition: 'background 0.3s ease'
    }}>
      {/* Inject Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .notebook-card {
          animation: fadeInUp 0.5s ease-out forwards;
          opacity: 0;
        }
        
        .modal-content {
          animation: slideIn 0.25s ease-out;
        }
        
        .toast {
          animation: fadeInUp 0.3s ease-out;
        }
        
        .skeleton {
          background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      {/* Header */}
      <header style={{
        background: darkMode ? 'linear-gradient(135deg, #6C4B14 0%, #5A400F 100%)' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
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
            onOpenSettings={onOpenSettings}
            darkMode={darkMode}
          />
        </div>
      </header>

      {/* Toast Message */}
      {message && (
        <div className="toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '14px 20px',
          background: message.includes('Error') ? '#fef2f2' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
          color: message.includes('Error') ? '#dc2626' : '#5D4037',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: 500,
          border: message.includes('Error') ? '1px solid #fecaca' : 'none'
        }}>
          <span>{message.includes('Error') ? '⚠️' : '🐵'}</span>
          <span>{message}</span>
          <button 
            onClick={() => setMessage('')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.7,
              padding: '4px',
              marginLeft: '8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 32px'
      }}>
        {/* Page Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '40px'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 8px',
              fontSize: '32px',
              fontWeight: 700,
              color: theme.text,
              fontFamily: "'Playfair Display', Georgia, serif",
              letterSpacing: '-0.02em'
            }}>
              My Notebooks
            </h2>
            <p style={{
              margin: 0,
              fontSize: '15px',
              color: theme.textSecondary
            }}>
              {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'} in your workspace
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
              color: '#5D4037',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 152, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 152, 0, 0.3)';
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            New Notebook
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '24px'
          }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                background: theme.cardBg,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: `1px solid ${theme.border}`,
                aspectRatio: '3 / 4'
              }}>
                <div className="skeleton" style={{ height: '65%', background: darkMode ? '#44403C' : undefined }} />
                <div style={{ padding: '12px', height: '35%' }}>
                  <div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '4px', marginBottom: '8px', background: darkMode ? '#44403C' : undefined }} />
                  <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px', background: darkMode ? '#44403C' : undefined }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && notebooks.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 40px',
            background: theme.cardBg,
            borderRadius: '24px',
            border: `2px dashed ${theme.border}`
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: darkMode ? '#44403C' : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              margin: '0 auto 24px'
            }}>
              📚
            </div>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '24px',
              fontWeight: 700,
              color: theme.text,
              fontFamily: "'Playfair Display', Georgia, serif"
            }}>
              Start your first notebook
            </h3>
            <p style={{
              margin: '0 0 32px',
              fontSize: '15px',
              color: theme.textSecondary,
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6
            }}>
              Create a notebook to organize your notes, ideas, and thoughts in one place.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                color: '#5D4037',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Create your first notebook
            </button>
          </div>
        )}

        {/* Notebooks Grid */}
        {!loading && notebooks.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '24px'
          }}>
            {notebooks.map((notebook, index) => (
              <div
                key={notebook.id}
                className="notebook-card"
                style={{
                  background: theme.cardBg,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: hoveredCard === notebook.id 
                    ? '0 12px 28px rgba(0,0,0,0.15)' 
                    : '0 2px 8px rgba(0,0,0,0.08)',
                  transform: hoveredCard === notebook.id ? 'translateY(-4px)' : 'translateY(0)',
                  animationDelay: `${index * 0.05}s`,
                  border: `1px solid ${theme.border}`,
                  aspectRatio: '3 / 4'
                }}
                onClick={() => onOpenNotebook(notebook.id)}
                onMouseEnter={() => setHoveredCard(notebook.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Cover Area */}
                <div style={{
                  height: '65%',
                  background: `linear-gradient(135deg, ${notebook.color} 0%, ${notebook.color}dd 100%)`,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <NotebookCoverIcon
                    color={notebook.color}
                    width={92}
                    height={102}
                    style={{
                      transform: hoveredCard === notebook.id ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                      transition: 'transform 0.25s ease',
                    }}
                  />

                  {/* Action buttons */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    display: 'flex',
                    gap: '4px',
                    opacity: hoveredCard === notebook.id ? 1 : 0,
                    transform: hoveredCard === notebook.id ? 'translateY(0)' : 'translateY(-4px)',
                    transition: 'all 0.2s ease'
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(notebook); }}
                      style={{
                        width: '28px',
                        height: '28px',
                        background: 'rgba(255,255,255,0.95)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNotebook(notebook); }}
                      style={{
                        width: '28px',
                        height: '28px',
                        background: 'rgba(255,255,255,0.95)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Note count badge */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: notebook.color,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {notebook.note_count} {notebook.note_count === 1 ? 'note' : 'notes'}
                  </div>
                </div>

                {/* Content */}
                <div style={{ 
                  padding: '12px', 
                  height: '35%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center'
                }}>
                  <h3 style={{
                    margin: '0 0 4px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.text,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {notebook.name}
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '11px',
                    color: theme.textSecondary
                  }}>
                    {formatDate(notebook.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingNotebook) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={() => { setShowCreateModal(false); setEditingNotebook(null); }}
        >
          <div
            className="modal-content"
            style={{
              background: theme.cardBg,
              borderRadius: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with color preview */}
            <div style={{
              height: '100px',
              background: `linear-gradient(135deg, ${newNotebookColor} 0%, ${newNotebookColor}dd 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <NotebookCoverIcon color={newNotebookColor} />
              <button
                onClick={() => { setShowCreateModal(false); setEditingNotebook(null); setNewNotebookName(''); }}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: getContrastColor(newNotebookColor),
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px' }}>
              <h2 style={{
                margin: '0 0 24px',
                fontSize: '24px',
                fontWeight: 700,
                color: theme.text,
                fontFamily: "'Playfair Display', Georgia, serif"
              }}>
                {editingNotebook ? 'Edit Notebook' : 'Create Notebook'}
              </h2>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.text
                }}>
                  Notebook Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Physics Notes, Project Ideas..."
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (editingNotebook ? handleUpdateNotebook() : handleCreateNotebook())}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: `2px solid ${theme.border}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: 'inherit',
                    background: darkMode ? '#1C1917' : '#ffffff',
                    color: theme.text
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = newNotebookColor;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${newNotebookColor}22`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.text
                }}>
                  Cover Color
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px'
                }}>
                  {NOTEBOOK_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewNotebookColor(color)}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '12px',
                        background: color,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: newNotebookColor === color ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: newNotebookColor === color 
                          ? `0 0 0 3px #ffffff, 0 0 0 5px ${color}` 
                          : '0 2px 4px rgba(0,0,0,0.1)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (newNotebookColor !== color) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (newNotebookColor !== color) {
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {newNotebookColor === color && (
                        <span style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: getContrastColor(color),
                          fontSize: '16px'
                        }}>
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => { setShowCreateModal(false); setEditingNotebook(null); setNewNotebookName(''); }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: darkMode ? '#44403C' : '#f3f4f6',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: theme.textSecondary,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#504C49' : '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? '#44403C' : '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  onClick={editingNotebook ? handleUpdateNotebook : handleCreateNotebook}
                  disabled={!newNotebookName.trim()}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: newNotebookColor,
                    color: getContrastColor(newNotebookColor),
                    border: 'none',
                    borderRadius: '12px',
                    cursor: newNotebookName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '15px',
                    fontWeight: 600,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: `0 4px 12px ${newNotebookColor}44`,
                    opacity: newNotebookName.trim() ? 1 : 0.4
                  }}
                  onMouseEnter={(e) => {
                    if (newNotebookName.trim()) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = `0 6px 16px ${newNotebookColor}55`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 12px ${newNotebookColor}44`;
                  }}
                >
                  {editingNotebook ? 'Save Changes' : 'Create Notebook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
