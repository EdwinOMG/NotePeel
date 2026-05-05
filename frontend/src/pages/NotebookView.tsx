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

export default function NotebookView({ notebookId, onBack, onOpenNote, onCreateNote: _onCreateNote, darkMode = false }: NotebookViewProps) {
  const [notebook, setNotebook] = useState<NotebookWithNotes | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [showPeelingModal, setShowPeelingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [shareLoading, setShareLoading] = useState(false);

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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setShowPeelingModal(true);

    try {
      let newNote;
      if (files.length === 1) {
        newNote = await notesAPI.upload(files[0], noteType, notebookId);
      } else {
        newNote = await notesAPI.uploadMulti(Array.from(files), noteType, notebookId);
      }
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

  const handleAddCollaborator = async () => {
    if (!shareEmail.trim()) return;
    setShareLoading(true);
    try {
      await notebooksAPI.addCollaborator(notebookId, shareEmail.trim(), shareRole);
      await loadNotebook();
      setShareEmail('');
      setMessage('🤝 Collaborator added!');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to add collaborator'));
    } finally {
      setShareLoading(false);
    }
  };

  const handleChangeRole = async (collaboratorId: number, newRole: string) => {
    try {
      await notebooksAPI.updateCollaboratorRole(notebookId, collaboratorId, newRole);
      await loadNotebook();
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: number) => {
    if (!confirm('Remove this collaborator?')) return;
    try {
      await notebooksAPI.removeCollaborator(notebookId, collaboratorId);
      await loadNotebook();
      setMessage('Collaborator removed');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const isOwner = notebook?.role === 'owner';
  const _canEdit = notebook?.role === 'owner' || notebook?.role === 'editor';

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', color: theme.text }}>📓 {notebook.name}</h1>
                {notebook.role && notebook.role !== 'owner' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    background: notebook.role === 'editor' ? '#e3f2fd' : '#f3e5f5',
                    color: notebook.role === 'editor' ? '#1565C0' : '#7B1FA2',
                  }}>
                    {notebook.role}
                  </span>
                )}
                {notebook.is_shared && notebook.role === 'owner' && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    background: darkMode ? 'rgba(76,175,80,0.2)' : '#e8f5e9',
                    color: '#4CAF50',
                  }}>
                    shared
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
                {notebook.note_count} note{notebook.note_count !== 1 ? 's' : ''}
                {notebook.role !== 'owner' && notebook.owner_username && (
                  <span> · shared by {notebook.owner_username}</span>
                )}
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

            <button
              onClick={() => setShowShareModal(true)}
              style={{
                padding: '10px 20px',
                background: notebook.is_shared
                  ? (darkMode ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9')
                  : theme.buttonBg,
                border: `1px solid ${notebook.is_shared ? '#4CAF50' : theme.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: notebook.is_shared ? '#4CAF50' : theme.text
              }}
            >
              👥 {notebook.is_shared ? `Shared (${notebook.collaborators?.length || 0})` : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
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

      {/* Share / Collaborate Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: theme.cardBg,
              padding: '30px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 6px', color: theme.text }}>👥 Share Notebook</h2>
            <p style={{ margin: '0 0 20px', color: theme.textSecondary, fontSize: '13px' }}>
              {isOwner
                ? 'Invite others to view or edit this notebook.'
                : `Shared by ${notebook.owner_username || notebook.owner_email}`}
            </p>

            {/* Add collaborator form (owner only) */}
            {isOwner && (
              <div style={{
                display: 'flex', gap: '8px', marginBottom: '20px',
                flexWrap: 'wrap'
              }}>
                <input
                  type="email"
                  placeholder="Enter email address..."
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCollaborator()}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '10px 14px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    background: darkMode ? '#3f3f5a' : '#fff',
                    color: theme.text,
                    fontSize: '14px',
                  }}
                />
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as 'viewer' | 'editor')}
                  style={{
                    padding: '10px 12px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    background: darkMode ? '#3f3f5a' : '#fff',
                    color: theme.text,
                    fontSize: '14px',
                  }}
                >
                  <option value="viewer">👁 Viewer</option>
                  <option value="editor">✏️ Editor</option>
                </select>
                <button
                  onClick={handleAddCollaborator}
                  disabled={shareLoading || !shareEmail.trim()}
                  style={{
                    padding: '10px 18px',
                    background: shareLoading || !shareEmail.trim() ? '#ccc' : '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: shareLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  {shareLoading ? '...' : 'Invite'}
                </button>
              </div>
            )}

            {/* Collaborator list */}
            <div style={{ marginBottom: '10px' }}>
              <h4 style={{ color: theme.textSecondary, fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px' }}>
                People with access
              </h4>

              {/* Owner */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px',
                background: darkMode ? '#3f3f5a' : '#f9f9f9',
                borderRadius: '8px',
                marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#FFC107', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 'bold', color: '#5D4037'
                  }}>
                    {(notebook.owner_username || 'O')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: theme.text, fontSize: '14px', fontWeight: 500 }}>
                      {notebook.owner_username || notebook.owner_email}
                      {isOwner && <span style={{ color: theme.textSecondary }}> (you)</span>}
                    </div>
                    <div style={{ color: theme.textSecondary, fontSize: '12px' }}>{notebook.owner_email}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
                  background: darkMode ? '#4a4a6a' : '#e0e0e0',
                  color: theme.textSecondary, fontWeight: 600
                }}>
                  Owner
                </span>
              </div>

              {/* Collaborators */}
              {(notebook.collaborators || []).map((collab) => (
                <div key={collab.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                  background: darkMode ? '#3f3f5a' : '#f9f9f9',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {collab.profile_picture ? (
                      <img src={collab.profile_picture} alt="" style={{
                        width: '32px', height: '32px', borderRadius: '50%'
                      }} />
                    ) : (
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: collab.role === 'editor' ? '#42A5F5' : '#AB47BC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 'bold', color: '#fff'
                      }}>
                        {(collab.username || collab.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ color: theme.text, fontSize: '14px', fontWeight: 500 }}>
                        {collab.username || collab.email}
                      </div>
                      <div style={{ color: theme.textSecondary, fontSize: '12px' }}>{collab.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isOwner ? (
                      <>
                        <select
                          value={collab.role}
                          onChange={(e) => handleChangeRole(collab.id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            background: darkMode ? '#252542' : '#fff',
                            color: theme.text,
                            fontSize: '12px',
                          }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          onClick={() => handleRemoveCollaborator(collab.id)}
                          style={{
                            padding: '4px 8px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#c62828',
                            fontSize: '16px',
                          }}
                          title="Remove collaborator"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
                        background: collab.role === 'editor' ? '#e3f2fd' : '#f3e5f5',
                        color: collab.role === 'editor' ? '#1565C0' : '#7B1FA2',
                        fontWeight: 600
                      }}>
                        {collab.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {(!notebook.collaborators || notebook.collaborators.length === 0) && (
                <p style={{
                  color: theme.textSecondary, textAlign: 'center',
                  padding: '15px', fontSize: '13px'
                }}>
                  No collaborators yet.{isOwner && ' Add someone above!'}
                </p>
              )}
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              style={{
                width: '100%',
                marginTop: '10px',
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