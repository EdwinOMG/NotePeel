import { useState, useEffect, useRef } from 'react';
import { notebooksAPI, notesAPI } from '../services/api';
import type { NotebookWithNotes } from '../types';

interface MobileNotebookViewProps {
  notebookId: number;
  onBack: () => void;
  onOpenNote: (noteId: number) => void;
  darkMode: boolean;
}

export default function MobileNotebookView({ notebookId, onBack, onOpenNote, darkMode }: MobileNotebookViewProps) {
  const [notebook, setNotebook] = useState<NotebookWithNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const theme = {
    bg: darkMode ? '#1a1a2e' : '#FFF8E1',
    cardBg: darkMode ? '#252542' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#5D4037',
    textSecondary: darkMode ? '#a1a1aa' : '#8D6E63',
    border: darkMode ? '#3f3f5a' : '#E0E0E0',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
  };

  useEffect(() => { loadNotebook(); }, [notebookId]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 3000); return () => clearTimeout(t); } }, [message]);

  const loadNotebook = async () => {
    try {
      const data = await notebooksAPI.getById(notebookId);
      setNotebook(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setShowTypeSheet(false);
    try {
      let newNote;
      if (files.length === 1) {
        newNote = await notesAPI.upload(files[0], noteType, notebookId);
      } else {
        newNote = await notesAPI.uploadMulti(Array.from(files), noteType, notebookId);
      }
      await notebooksAPI.addNote(notebookId, newNote.id);
      setMessage('🐵 Note peeled successfully!');
      // Auto-open the newly created note
      onOpenNote(newNote.id);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: theme.textSecondary }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'bounce 1s ease-in-out infinite' }}>📓</div>
          <p>Loading notebook...</p>
          <style>{`@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>😵</div>
          <p style={{ color: theme.text }}>{message || 'Notebook not found'}</p>
          <button onClick={onBack} style={{ marginTop: '16px', padding: '12px 24px', background: '#FFC107', border: 'none', borderRadius: '12px', fontWeight: 600, color: '#5D4037', fontSize: '16px' }}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ background: theme.headerBg, paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        {/* Color banner */}
        <div style={{ height: '4px', background: notebook.color }} />
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onBack}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '16px',
                cursor: 'pointer',
                color: darkMode ? '#e4e4e7' : '#5D4037',
                fontWeight: 600,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              ←
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: darkMode ? '#e4e4e7' : '#5D4037', fontFamily: "'Inter', sans-serif" }}>
                📓 {notebook.name}
                {notebook.is_shared && (
                  <span style={{
                    fontSize: '11px',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    background: 'rgba(76,175,80,0.2)',
                    color: '#4CAF50',
                    verticalAlign: 'middle',
                  }}>
                    👥 shared
                  </span>
                )}
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: darkMode ? '#a1a1aa' : '#8D6E63', fontFamily: "'Inter', sans-serif" }}>
                {notebook.notes.length} note{notebook.notes.length !== 1 ? 's' : ''}
                {notebook.role && notebook.role !== 'owner' && notebook.owner_username && (
                  <span> · by {notebook.owner_username}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: message.includes('Error') ? '#C62828' : '#2E7D32',
          color: '#fff', padding: '12px 24px', borderRadius: '14px', fontSize: '14px', fontWeight: 600, zIndex: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontFamily: "'Inter', sans-serif",
          animation: 'fadeInUp 0.3s ease-out',
        }}>
          {message}
        </div>
      )}

      {/* Notes list */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {notebook.notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textSecondary }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
            <h3 style={{ color: theme.text, fontFamily: "'Inter', sans-serif", fontWeight: 600, margin: '0 0 8px' }}>No notes yet</h3>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', margin: '0 0 24px' }}>
              Upload a photo of your notes to get started!
            </p>
            <button
              onClick={() => setShowTypeSheet(true)}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                color: '#5D4037',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 4px 16px rgba(255, 152, 0, 0.3)',
              }}
            >
              📸 Upload First Note
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notebook.notes.map((note, idx) => (
              <div
                key={note.id}
                onClick={() => onOpenNote(note.id)}
                style={{
                  background: theme.cardBg,
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                  border: `1px solid ${theme.border}`,
                  cursor: 'pointer',
                  animation: 'fadeInUp 0.4s ease-out forwards',
                  animationDelay: `${idx * 0.05}s`,
                  opacity: 0,
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      margin: '0 0 6px',
                      color: theme.text,
                      fontSize: '15px',
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      📄 {note.title}
                    </h3>
                    <p style={{ margin: 0, color: theme.textSecondary, fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>
                      {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {note.subject && (
                      <span style={{
                        display: 'inline-block', marginTop: '6px', padding: '2px 8px', borderRadius: '8px',
                        background: darkMode ? '#3f3f5a' : '#FFF8E1', fontSize: '11px', color: '#FF9800', fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        📁 {note.subject}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: '#FF9800', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                    View →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB Upload Button */}
      {notebook.notes.length > 0 && (
        <button
          onClick={() => setShowTypeSheet(true)}
          disabled={uploading}
          style={{
            position: 'fixed',
            bottom: 'max(24px, env(safe-area-inset-bottom))',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            background: uploading ? (darkMode ? '#3f3f5a' : '#ccc') : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
            border: 'none',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: '28px',
            boxShadow: '0 6px 20px rgba(255, 152, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            transition: 'transform 0.2s',
          }}
        >
          {uploading ? '⏳' : '📸'}
        </button>
      )}

      {/* Upload peeling overlay */}
      {uploading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
        }}>
          <img src="/monkey-loading.png" alt="Loading" style={{ width: '150px', animation: 'bounce 1s ease-in-out infinite' }} />
          <div style={{ color: '#FFC107', fontSize: '20px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>🍌 Peeling your notes...</div>
          <div style={{ color: '#fff', fontSize: '13px', opacity: 0.7, fontFamily: "'Inter', sans-serif" }}>This may take a few seconds</div>
          <style>{`@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }`}</style>
        </div>
      )}

      {/* Note Type Sheet */}
      {showTypeSheet && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowTypeSheet(false)}
        >
          <div
            style={{
              background: theme.cardBg, borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))', animation: 'slideUp 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: theme.border, borderRadius: '2px', margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 6px', color: theme.text, fontSize: '18px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
              📸 Upload Note
            </h3>
            <p style={{ margin: '0 0 20px', color: theme.textSecondary, fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>
              Choose a note type, then snap or select a photo
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {([
                { value: 'default', emoji: '📝', label: 'Default Notes', desc: 'General handwritten notes' },
                { value: 'lecture', emoji: '📚', label: 'Lecture Notes', desc: 'Class lectures & slides' },
                { value: 'meeting', emoji: '📋', label: 'Meeting Notes', desc: 'Meeting minutes & action items' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNoteType(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
                    background: noteType === opt.value ? (darkMode ? '#3f3f5a' : '#FFF8E1') : 'transparent',
                    border: noteType === opt.value ? '2px solid #FFC107' : `1px solid ${theme.border}`,
                    borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '28px' }}>{opt.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: theme.text, fontSize: '15px', fontFamily: "'Inter', sans-serif" }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  flex: 1, padding: '18px', background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                  border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#fff',
                  fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 16px rgba(255, 152, 0, 0.3)',
                }}
              >
                📷 Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, padding: '18px', background: 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
                  border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#5D4037',
                  fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 16px rgba(255, 193, 7, 0.3)',
                }}
              >
                🖼️ Choose Photo
              </button>
            </div>

            <button
              onClick={() => setShowTypeSheet(false)}
              style={{
                width: '100%', marginTop: '10px', padding: '14px', background: 'transparent',
                border: 'none', fontSize: '15px', cursor: 'pointer', color: theme.textSecondary, fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />
      <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" multiple onChange={handleUpload} style={{ display: 'none' }} />
    </div>
  );
}
