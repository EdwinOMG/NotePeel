import { useState, useEffect, useRef } from 'react';
import { notebooksAPI, notesAPI } from '../services/api';
import NotebookCoverIcon from '../components/NotebookCoverIcon';
import ProfileMenu from '../components/ProfileMenu';
import type { NotebookWithNotes, Note } from '../types';
import { getUploadFeedback } from '../utils/noteExtraction';

interface NotebookViewProps {
  notebookId: number;
  userEmail: string;
  onBack: () => void;
  onOpenNote: (noteId: number, notebookId: number, notebookColor: string) => void;
  onCreateNote: (notebookId: number) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  darkMode?: boolean;
}

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16),
  };
};

const mixHexColors = (baseHex: string, mixHex: string, ratio: number) => {
  const base = hexToRgb(baseHex);
  const mix = hexToRgb(mixHex);
  const clampRatio = Math.max(0, Math.min(1, ratio));

  const channel = (from: number, to: number) => Math.round(from + (to - from) * clampRatio);

  return `rgb(${channel(base.r, mix.r)}, ${channel(base.g, mix.g)}, ${channel(base.b, mix.b)})`;
};

const rgbaFromHex = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getContrastColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.45 ? '#1a1a1a' : '#ffffff';
};

export default function NotebookView({ notebookId, userEmail, onBack, onOpenNote, onCreateNote, onOpenSettings, onLogout, darkMode = false }: NotebookViewProps) {
  const [notebook, setNotebook] = useState<NotebookWithNotes | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [showPeelingModal, setShowPeelingModal] = useState(false);
  const notebookColor = notebook?.color ?? '#1F2A44';
  const headerText = getContrastColor(notebookColor);
  const headerTextSecondary = rgbaFromHex(getContrastColor(notebookColor), 0.65);

  const theme = {
    bg: darkMode ? '#1C1917' : '#f5f5f5',
    cardBg: darkMode ? '#292524' : '#ffffff',
    text: darkMode ? '#F5F0E8' : '#1a1a1a',
    textSecondary: darkMode ? '#A8A29E' : '#666666',
    border: darkMode ? '#44403C' : '#e8e8e8',
    accentSoft: darkMode ? '#3C3836' : mixHexColors(notebookColor, '#FFFFFF', 0.9),
    shadowSoft: darkMode ? 'rgba(0,0,0,0.3)' : rgbaFromHex(notebookColor, 0.08),
    shadowMedium: darkMode ? 'rgba(0,0,0,0.3)' : rgbaFromHex(notebookColor, 0.14),
    shadowStrong: darkMode ? 'rgba(0,0,0,0.3)' : rgbaFromHex(notebookColor, 0.22),
  };

  useEffect(() => {
    loadNotebook();
  }, [notebookId]);

  const loadNotebook = async () => {
    try {
      const data = await notebooksAPI.getById(notebookId);
      setNotebook(data);
    } catch (err) {
      setMessage('Error loading notebook: ' + (err instanceof Error ? err.message : 'Failed'));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableNotes = async () => {
    try {
      const notes = await notebooksAPI.getAvailableNotes(notebookId);
      setAvailableNotes(notes);
      setShowAddModal(true);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleAddNote = async (noteId: number) => {
    try {
      await notebooksAPI.addNote(notebookId, noteId);
      await loadNotebook();
      setAvailableNotes(availableNotes.filter(n => n.id !== noteId));
      setMessage('🐵 Note added to notebook!');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleRemoveNote = async (noteId: number) => {
    if (!confirm('Remove this note from the notebook?')) return;

    try {
      await notebooksAPI.removeNote(notebookId, noteId);
      await loadNotebook();
      setMessage('Note removed from notebook');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowPeelingModal(true);

    try {
      const newNote = await notesAPI.upload(file, noteType, notebookId);
      // Add to notebook
      await notebooksAPI.addNote(notebookId, newNote.id);
      await loadNotebook();
      const feedback = getUploadFeedback(newNote);
      setMessage(feedback.message);
      // Open the new note in editor
      onOpenNote(newNote.id, notebookId, notebookColor);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    } finally {
      setUploading(false);
      setShowPeelingModal(false);
      e.target.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };


  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: darkMode ? '#1C1917' : '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: theme.textSecondary }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🍌</div>
          Loading notebook...
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: theme.text }}>Notebook not found</h2>
          {message && (
            <p style={{ color: '#c62828', marginBottom: '15px' }}>{message}</p>
          )}
          <button onClick={onBack} style={{
            padding: '10px 20px',
            background: '#FFC107',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#5D4037',
            fontWeight: 600
          }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      {/* Hero Header */}
      <div style={{ background: notebookColor }}>
        {/* Top nav row */}
        <div style={{ padding: '18px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: headerText,
              fontSize: '14px',
              fontWeight: 500,
              backdropFilter: 'blur(4px)',
            }}
          >
            ← Back
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as 'default' | 'lecture' | 'meeting')}
              style={{
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.18)',
                fontSize: '14px',
                color: headerText,
                backdropFilter: 'blur(4px)',
                cursor: 'pointer',
              }}
            >
              <option value="default">📝 Default</option>
              <option value="lecture">📚 Lecture</option>
              <option value="meeting">📋 Meeting</option>
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '10px 22px',
                background: uploading ? 'rgba(255,255,255,0.3)' : '#FFC107',
                color: uploading ? headerText : '#5D4037',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {uploading ? '🍌 Peeling...' : '+ Upload Note'}
            </button>

            <button
              onClick={loadAvailableNotes}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: headerText,
                fontSize: '14px',
                fontWeight: 500,
                backdropFilter: 'blur(4px)',
              }}
            >
              📎 Add Existing
            </button>

            <ProfileMenu
              userEmail={userEmail}
              onLogout={onLogout}
              onOpenSettings={onOpenSettings}
              darkMode={darkMode}
              variant="hero"
              heroTextColor={headerText}
            />
          </div>
        </div>

        {/* Notebook identity */}
        <div style={{ padding: '4px 30px 28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <NotebookCoverIcon color={notebook.color} width={58} height={66} />
          <div>
            <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700, color: headerText, letterSpacing: '-0.5px' }}>
              {notebook.name}
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: '13px', color: headerTextSecondary }}>
              {notebook.note_count} note{notebook.note_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Fade into content */}
        <div style={{
          height: '32px',
          background: darkMode
            ? `linear-gradient(to bottom, ${notebookColor}, #1C1917)`
            : `linear-gradient(to bottom, ${notebookColor}, #f5f5f5)`,
        }} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 30px',
          background: message.includes('Error') ? '#ffebee' : (darkMode ? '#3C3836' : theme.accentSoft),
          color: message.includes('Error') ? '#c62828' : theme.text,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: message.includes('Error') ? 'none' : `1px solid ${theme.border}`,
        }}>
          <span>{message}</span>
          <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text }}>✕</button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Empty State */}
        {notebook.notes.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            background: theme.cardBg,
            borderRadius: '16px',
            boxShadow: darkMode ? '0 4px 12px rgba(0,0,0,0.2)' : `0 12px 30px ${theme.shadowMedium}`,
            border: `1px solid ${theme.border}`
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📝</div>
            <h3 style={{ color: theme.text, marginBottom: '10px' }}>No notes in this notebook</h3>
            <p style={{ color: theme.textSecondary, marginBottom: '20px' }}>Upload a new note or add an existing one!</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px 24px',
                  background: notebookColor,
                  color: getContrastColor(notebookColor),
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                + Upload Note
              </button>
              <button
                onClick={loadAvailableNotes}
                style={{
                  padding: '12px 24px',
                  background: theme.buttonBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: theme.text
                }}
              >
                📎 Add Existing
              </button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {notebook.notes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notebook.notes.map(note => (
              <div
                key={note.id}
                style={{
                  background: theme.cardBg,
                  borderRadius: '12px',
                  padding: '20px 20px 20px 24px',
                  boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : `0 4px 16px ${theme.shadowSoft}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  border: `1px solid ${theme.border}`,
                  borderLeft: `4px solid ${notebookColor}`,
                }}
                onClick={() => onOpenNote(note.id, notebookId, notebookColor)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : `0 10px 28px ${theme.shadowStrong}`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderLeft = '4px solid #FFC107';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : `0 4px 16px ${theme.shadowSoft}`;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderLeft = `4px solid ${notebookColor}`;
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px', color: theme.text, fontSize: '16px' }}>
                    📄 {note.title}
                  </h3>
                  <p style={{ margin: 0, color: theme.textSecondary, fontSize: '13px' }}>
                    Created {formatDate(note.created_at)}
                  </p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveNote(note.id); }}
                    style={{
                      padding: '6px 12px',
                      background: darkMode ? 'rgba(198, 40, 40, 0.2)' : '#ffebee',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#c62828'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Existing Notes Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: theme.cardBg,
              padding: '30px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '70vh',
              overflow: 'auto',
              boxShadow: darkMode ? '0 8px 32px rgba(0,0,0,0.2)' : `0 20px 50px ${theme.shadowStrong}`,
              border: `1px solid ${theme.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px', color: theme.text }}>📎 Add Existing Notes</h2>

            {availableNotes.length === 0 ? (
              <p style={{ color: theme.textSecondary, textAlign: 'center', padding: '20px' }}>
                All your notes are already in this notebook!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availableNotes.map(note => (
                  <div
                    key={note.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: darkMode ? '#3C3836' : theme.accentSoft,
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <span style={{ color: theme.text }}>📄 {note.title}</span>
                    <button
                      onClick={() => handleAddNote(note.id)}
                      style={{
                        padding: '6px 12px',
                        background: notebookColor,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: getContrastColor(notebookColor),
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddModal(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                background: theme.buttonBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: theme.text
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Peeling Loading Modal */}
      {showPeelingModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 4000,
          flexDirection: 'column',
          gap: '20px'
        }}>
          <img 
            src="/monkey-loading.png" 
            alt="Loading monkey" 
            style={{ 
              width: '200px', 
              height: 'auto',
              animation: 'bounce 1s ease-in-out infinite',
            }} 
          />
          <div style={{ 
            color: '#FFC107', 
            fontSize: '24px', 
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            🍌 Peeling your notes...
          </div>
          <div style={{
            color: '#fff',
            fontSize: '14px',
            opacity: 0.7
          }}>
            This may take a few seconds
          </div>
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-15px); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
