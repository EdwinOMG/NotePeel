import { useState, useEffect, useRef } from 'react';
import { notebooksAPI, notesAPI } from '../services/api';
import type { NotebookWithNotes, Note } from '../types';

interface NotebookViewProps {
  notebookId: number;
  onBack: () => void;
  onOpenNote: (noteId: number, notebookId: number) => void;
  onCreateNote: (notebookId: number) => void;
  darkMode?: boolean;
}

export default function NotebookView({ notebookId, onBack, onOpenNote, onCreateNote, darkMode = false }: NotebookViewProps) {
  const [notebook, setNotebook] = useState<NotebookWithNotes | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [showPeelingModal, setShowPeelingModal] = useState(false);

  // Theme colors
  const theme = {
    bg: darkMode ? '#1a1a2e' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#252542' : '#ffffff',
    headerBg: darkMode ? '#2d2d4a' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#5D4037',
    textSecondary: darkMode ? '#a1a1aa' : '#8D6E63',
    border: darkMode ? '#3f3f5a' : '#ddd',
    buttonBg: darkMode ? '#3f3f5a' : '#f5f5f5',
    buttonHover: darkMode ? '#4a4a6a' : '#e8e8e8',
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
      setMessage('🐵 Note created and added to notebook!');
      // Open the new note in editor
      onOpenNote(newNote.id, notebookId);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      completed: { bg: '#E8F5E9', color: '#2E7D32', text: '✓ Ready' },
      processing: { bg: '#FFF3E0', color: '#E65100', text: '⏳ Processing' },
      failed: { bg: '#FFEBEE', color: '#C62828', text: '✕ Failed' },
      pending: { bg: '#E3F2FD', color: '#1565C0', text: '○ Pending' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        background: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
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
      {/* Header */}
      <div style={{
        background: theme.headerBg,
        borderBottom: `1px solid ${theme.border}`,
        boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        {/* Color Banner */}
        <div style={{ height: '6px', background: notebook.color }} />
        
        <div style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '8px 16px',
                background: theme.buttonBg,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: theme.text
              }}
            >
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', color: theme.text }}>📓 {notebook.name}</h1>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
                {notebook.note_count} note{notebook.note_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Note Type Selector */}
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as 'default' | 'lecture' | 'meeting')}
              style={{
                padding: '8px 12px',
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                background: darkMode ? '#3f3f5a' : '#FFF8E1',
                fontSize: '14px',
                color: theme.text
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
                padding: '10px 20px',
                background: uploading ? '#ccc' : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                color: '#5D4037',
                border: 'none',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {uploading ? '🍌 Peeling...' : '+ Upload Note'}
            </button>
            
            <button
              onClick={loadAvailableNotes}
              style={{
                padding: '10px 20px',
                background: theme.buttonBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: theme.text
              }}
            >
              📎 Add Existing
            </button>
          </div>
        </div>
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
          background: message.includes('Error') ? '#ffebee' : (darkMode ? '#3f3f5a' : '#FFF8E1'),
          color: message.includes('Error') ? '#c62828' : theme.text,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
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
            boxShadow: darkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)',
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
                  background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                  color: '#5D4037',
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
                  padding: '20px',
                  boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  border: `1px solid ${theme.border}`
                }}
                onClick={() => onOpenNote(note.id, notebookId)}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)'}
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
                  {getStatusBadge(note.status)}
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
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
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
                      background: darkMode ? '#3f3f5a' : '#f9f9f9',
                      borderRadius: '8px'
                    }}
                  >
                    <span style={{ color: theme.text }}>📄 {note.title}</span>
                    <button
                      onClick={() => handleAddNote(note.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#FFC107',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#5D4037'
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
                border: 'none',
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
