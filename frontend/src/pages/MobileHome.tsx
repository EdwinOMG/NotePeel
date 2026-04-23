import { useState, useEffect, useRef } from 'react';
import { notebooksAPI, notesAPI } from '../services/api';
import type { Notebook } from '../types';

interface MobileHomeProps {
  userEmail: string;
  onLogout: () => void;
  onOpenNotebook: (notebookId: number) => void;
  onOpenSettings: () => void;
  darkMode: boolean;
}

const NOTEBOOK_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#e94560', '#f39189', '#f8b500', '#ff6b35',
  '#00a896', '#028090', '#05668d', '#2d6a4f',
];

export default function MobileHome({ userEmail, onLogout, onOpenNotebook, onOpenSettings, darkMode }: MobileHomeProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#1a1a2e');
  const [showMenu, setShowMenu] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [uploading, setUploading] = useState(false);
  const [selectedUploadNotebook, setSelectedUploadNotebook] = useState<number | null>(null);
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

  useEffect(() => { loadNotebooks(); }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 3000); return () => clearTimeout(t); } }, [message]);

  const loadNotebooks = async () => {
    try {
      const data = await notebooksAPI.getAll();
      setNotebooks(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { setMessage('Please enter a name'); return; }
    try {
      const nb = await notebooksAPI.create({ name: newName.trim(), color: newColor });
      setNotebooks([nb, ...notebooks]);
      setNewName(''); setNewColor('#1a1a2e'); setShowCreateSheet(false);
      setMessage('Notebook created!');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleUpdate = async () => {
    if (!editingNotebook || !newName.trim()) return;
    try {
      const updated = await notebooksAPI.update(editingNotebook.id, { name: newName.trim(), color: newColor });
      setNotebooks(notebooks.map(n => n.id === updated.id ? updated : n));
      setEditingNotebook(null); setNewName(''); setShowCreateSheet(false);
      setMessage('Notebook updated!');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleDelete = async (nb: Notebook) => {
    if (!confirm(`Delete "${nb.name}"?`)) return;
    try {
      await notebooksAPI.delete(nb.id);
      setNotebooks(notebooks.filter(n => n.id !== nb.id));
      setMessage('Notebook deleted');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUploadNotebook) return;
    setUploading(true); setShowQuickUpload(false);
    try {
      const newNote = await notesAPI.upload(file, noteType, selectedUploadNotebook);
      await notebooksAPI.addNote(selectedUploadNotebook, newNote.id);
      setMessage('🐵 Note peeled successfully!');
      // Navigate into the notebook so user sees the new note
      onOpenNotebook(selectedUploadNotebook);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getContrastColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1a1a2e' : '#ffffff';
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
      `}</style>

      {/* Header */}
      <div style={{
        background: theme.headerBg,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(255, 193, 7, 0.3)',
      }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/monkey-loading.png" alt="NotePeel" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            <h1 style={{
              margin: 0, fontSize: '22px', fontWeight: 700, color: darkMode ? '#e4e4e7' : '#5D4037',
              fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '-0.02em',
            }}>
              NotePeel
            </h1>
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '12px',
              padding: '8px 12px', fontSize: '20px', cursor: 'pointer',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
        }} onClick={() => setShowMenu(false)}>
          <div
            style={{
              position: 'absolute', top: '70px', right: '16px',
              background: theme.cardBg, borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: '200px',
              border: `1px solid ${theme.border}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: `1px solid ${theme.border}` }}>
              <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>Signed in as</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: theme.text, fontWeight: 600, fontFamily: "'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</p>
            </div>
            <button
              onClick={() => { setShowMenu(false); onOpenSettings(); }}
              style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'left', fontSize: '15px', color: theme.text, fontFamily: "'Inter', sans-serif" }}
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => { setShowMenu(false); onLogout(); }}
              style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '15px', color: '#C62828', fontFamily: "'Inter', sans-serif" }}
            >
              🚪 Log Out
            </button>
          </div>
        </div>
      )}

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

      {/* Mobile banner */}
      <div style={{
        background: darkMode ? '#2a2a40' : '#FFF3E0',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <span style={{ fontSize: '16px' }}>📱</span>
        <span style={{ fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif", lineHeight: '1.4' }}>
          Mobile mode — upload & view notes here, edit on desktop
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'bounce 1s ease-in-out infinite' }}>🍌</div>
            <p style={{ color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>Loading notebooks...</p>
          </div>
        ) : notebooks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📓</div>
            <h2 style={{ color: theme.text, fontFamily: "'Inter', sans-serif", fontWeight: 700, margin: '0 0 8px' }}>No notebooks yet</h2>
            <p style={{ color: theme.textSecondary, fontFamily: "'Inter', sans-serif", fontSize: '14px', margin: '0 0 24px' }}>
              Create your first notebook to start organizing notes!
            </p>
            <button
              onClick={() => setShowCreateSheet(true)}
              style={{
                padding: '16px 32px', background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                color: '#5D4037', border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '16px',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 16px rgba(255,152,0,0.3)',
              }}
            >
              + Create Notebook
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notebooks.map((nb, idx) => (
              <div
                key={nb.id}
                style={{
                  background: theme.cardBg, borderRadius: '16px', overflow: 'hidden',
                  boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                  border: `1px solid ${theme.border}`,
                  animation: 'fadeInUp 0.4s ease-out forwards',
                  animationDelay: `${idx * 0.05}s`, opacity: 0,
                }}
              >
                {/* Color strip */}
                <div style={{ height: '6px', background: nb.color }} />
                <div
                  onClick={() => onOpenNotebook(nb.id)}
                  style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: theme.text,
                      fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      📓 {nb.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                      {nb.note_count} note{nb.note_count !== 1 ? 's' : ''} · {new Date(nb.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingNotebook(nb); setNewName(nb.name); setNewColor(nb.color); setShowCreateSheet(true); }}
                      style={{ background: darkMode ? '#3f3f5a' : '#f3f4f6', border: 'none', borderRadius: '10px', padding: '8px 10px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(nb); }}
                      style={{ background: darkMode ? 'rgba(198,40,40,0.2)' : '#ffebee', border: 'none', borderRadius: '10px', padding: '8px 10px', fontSize: '14px', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB - Create Notebook */}
      <button
        onClick={() => { setEditingNotebook(null); setNewName(''); setNewColor('#1a1a2e'); setShowCreateSheet(true); }}
        style={{
          position: 'fixed', bottom: 'max(24px, env(safe-area-inset-bottom))', right: '20px',
          width: '60px', height: '60px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
          border: 'none', cursor: 'pointer', fontSize: '28px',
          boxShadow: '0 6px 20px rgba(255,152,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}
      >
        +
      </button>

      {/* Upload peeling overlay */}
      {uploading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
        }}>
          <img src="/monkey-loading.png" alt="Loading" style={{ width: '150px', animation: 'bounce 1s ease-in-out infinite' }} />
          <div style={{ color: '#FFC107', fontSize: '20px', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>🍌 Peeling your notes...</div>
          <div style={{ color: '#fff', fontSize: '13px', opacity: 0.7, fontFamily: "'Inter', sans-serif" }}>This may take a few seconds</div>
        </div>
      )}

      {/* Create/Edit Notebook Sheet */}
      {showCreateSheet && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => { setShowCreateSheet(false); setEditingNotebook(null); }}
        >
          <div
            style={{
              background: theme.cardBg, borderRadius: '24px 24px 0 0', width: '100%',
              padding: '0', maxHeight: '85vh', overflow: 'auto', animation: 'slideUp 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Color preview header */}
            <div style={{ height: '80px', background: newColor, borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '36px' }}>📓</span>
            </div>

            <div style={{ padding: '24px 20px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
              <h3 style={{ margin: '0 0 20px', color: theme.text, fontSize: '20px', fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>
                {editingNotebook ? 'Edit Notebook' : 'Create Notebook'}
              </h3>

              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: theme.text, fontFamily: "'Inter', sans-serif" }}>
                Name
              </label>
              <input
                type="text"
                placeholder="e.g., Physics Notes..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '14px 16px', border: `2px solid ${theme.border}`, borderRadius: '14px',
                  fontSize: '16px', boxSizing: 'border-box', outline: 'none', background: darkMode ? '#1a1a2e' : '#fff',
                  color: theme.text, fontFamily: "'Inter', sans-serif",
                }}
              />

              <label style={{ display: 'block', margin: '20px 0 12px', fontSize: '14px', fontWeight: 600, color: theme.text, fontFamily: "'Inter', sans-serif" }}>
                Cover Color
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px' }}>
                {NOTEBOOK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{
                      aspectRatio: '1', borderRadius: '12px', background: c, border: 'none', cursor: 'pointer',
                      transform: newColor === c ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: newColor === c ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : '0 2px 4px rgba(0,0,0,0.1)',
                      transition: 'all 0.2s', position: 'relative',
                    }}
                  >
                    {newColor === c && (
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getContrastColor(c), fontSize: '16px' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowCreateSheet(false); setEditingNotebook(null); }}
                  style={{
                    flex: 1, padding: '16px', background: darkMode ? '#3f3f5a' : '#f3f4f6', border: 'none',
                    borderRadius: '14px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', color: theme.textSecondary,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={editingNotebook ? handleUpdate : handleCreate}
                  style={{
                    flex: 1, padding: '16px', background: newColor, color: getContrastColor(newColor), border: 'none',
                    borderRadius: '14px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif", boxShadow: `0 4px 12px ${newColor}44`,
                  }}
                >
                  {editingNotebook ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Upload Sheet */}
      {showQuickUpload && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowQuickUpload(false)}
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
              📸 Quick Upload
            </h3>
            <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>
              Choose a notebook and note type
            </p>

            {/* Notebook selection */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: theme.text, fontFamily: "'Inter', sans-serif" }}>Notebook</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '150px', overflowY: 'auto' }}>
              {notebooks.map(nb => (
                <button
                  key={nb.id}
                  onClick={() => setSelectedUploadNotebook(nb.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                    background: selectedUploadNotebook === nb.id ? (darkMode ? '#3f3f5a' : '#FFF8E1') : 'transparent',
                    border: selectedUploadNotebook === nb.id ? '2px solid #FFC107' : `1px solid ${theme.border}`,
                    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: nb.color, flexShrink: 0 }} />
                  <span style={{ color: theme.text, fontSize: '14px', fontFamily: "'Inter', sans-serif" }}>{nb.name}</span>
                </button>
              ))}
            </div>

            {/* Note type */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: theme.text, fontFamily: "'Inter', sans-serif" }}>Note Type</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {(['default', 'lecture', 'meeting'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNoteType(t)}
                  style={{
                    flex: 1, padding: '10px', border: noteType === t ? '2px solid #FFC107' : `1px solid ${theme.border}`,
                    borderRadius: '10px', background: noteType === t ? (darkMode ? '#3f3f5a' : '#FFF8E1') : 'transparent',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: theme.text, fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {t === 'default' ? '📝' : t === 'lecture' ? '📚' : '📋'} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => selectedUploadNotebook && cameraInputRef.current?.click()}
                disabled={!selectedUploadNotebook}
                style={{
                  flex: 1, padding: '18px',
                  background: selectedUploadNotebook ? 'linear-gradient(135deg, #FF9800, #F57C00)' : (darkMode ? '#3f3f5a' : '#e0e0e0'),
                  border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 700, cursor: selectedUploadNotebook ? 'pointer' : 'not-allowed',
                  color: selectedUploadNotebook ? '#fff' : theme.textSecondary,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                📷 Take Photo
              </button>
              <button
                onClick={() => selectedUploadNotebook && fileInputRef.current?.click()}
                disabled={!selectedUploadNotebook}
                style={{
                  flex: 1, padding: '18px',
                  background: selectedUploadNotebook ? 'linear-gradient(135deg, #FFC107, #FFB300)' : (darkMode ? '#3f3f5a' : '#e0e0e0'),
                  border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 700, cursor: selectedUploadNotebook ? 'pointer' : 'not-allowed',
                  color: selectedUploadNotebook ? '#5D4037' : theme.textSecondary,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                🖼️ Choose Photo
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
    </div>
  );
}
