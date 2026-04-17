import { useState, useEffect } from 'react';
import { notesAPI } from '../services/api';
import type { NoteWithImage, FlashcardSet } from '../types';

interface MobileNoteViewerProps {
  noteId: number;
  onBack: () => void;
  darkMode: boolean;
}

export default function MobileNoteViewer({ noteId, onBack, darkMode }: MobileNoteViewerProps) {
  const [note, setNote] = useState<NoteWithImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  
  // AI states
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<{question: string; answer: string}[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [flashcardTitle, setFlashcardTitle] = useState('');
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

  const theme = {
    bg: darkMode ? '#1a1a2e' : '#FFF8E1',
    cardBg: darkMode ? '#252542' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#333333',
    textSecondary: darkMode ? '#a1a1aa' : '#8D6E63',
    border: darkMode ? '#3f3f5a' : '#E0E0E0',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
  };

  useEffect(() => {
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    try {
      const data = await notesAPI.getById(noteId);
      setNote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!note) return;
    setGeneratingSummary(true);
    try {
      const result = await notesAPI.summarize(note.id);
      setSummaryText(result.summary);
      setShowSummary(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarize');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleFlashcards = async () => {
    if (!note) return;
    setGeneratingFlashcards(true);
    try {
      const result = await notesAPI.generateFlashcards(note.id);
      setFlashcards(result.cards);
      setFlashcardTitle(result.title);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setShowFlashcards(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: theme.textSecondary }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'bounce 1s ease-in-out infinite' }}>🍌</div>
          <p>Loading note...</p>
          <style>{`@keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>😵</div>
          <p style={{ color: theme.text, marginBottom: '16px' }}>{error || 'Note not found'}</p>
          <button onClick={onBack} style={{ padding: '12px 24px', background: '#FFC107', border: 'none', borderRadius: '12px', fontWeight: 600, color: '#5D4037', fontSize: '16px' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const content = note.structured_text || note.raw_text || '';
    const isHTML = content.includes('<') && content.includes('>');

    if (activeTab === 'image') {
      return note.image_url ? (
        <div style={{ padding: '16px' }}>
          <img
            src={note.image_url}
            alt="Original note"
            style={{ width: '100%', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
          />
        </div>
      ) : (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: theme.textSecondary }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
          <p>No image available</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        {isHTML ? (
          <div
            dangerouslySetInnerHTML={{ __html: content }}
            style={{
              color: theme.text,
              fontSize: '15px',
              lineHeight: '1.7',
              wordBreak: 'break-word',
            }}
          />
        ) : (
          <div style={{ color: theme.text, fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {content}
          </div>
        )}
        {!content && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme.textSecondary }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
            <p>This note is empty.</p>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>Open it on desktop to edit.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes flipIn { from { transform: rotateY(90deg); opacity: 0; } to { transform: rotateY(0); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{
        background: theme.headerBg,
        padding: '16px 16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              color: darkMode ? '#e4e4e7' : '#5D4037',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: "'Inter', sans-serif",
            }}>
              {note.title || 'Untitled'}
            </h1>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: darkMode ? '#a1a1aa' : '#8D6E63',
              opacity: 0.8,
            }}>
              {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {note.subject ? ` · ${note.subject}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        background: theme.cardBg,
        borderBottom: `1px solid ${theme.border}`,
        position: 'sticky',
        top: '0',
        zIndex: 90,
      }}>
        {(['text', 'image'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #FFC107' : '3px solid transparent',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? (darkMode ? '#FFC107' : '#E65100') : theme.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {tab === 'text' ? '📝 Text' : '📷 Original'}
          </button>
        ))}
      </div>

      {/* Desktop edit banner */}
      <div style={{
        background: darkMode ? '#2a2a40' : '#FFF3E0',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <span style={{ fontSize: '14px' }}>💻</span>
        <span style={{ fontSize: '12px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>
          Open on desktop to edit this note
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </div>

      {/* AI Actions Bar */}
      <div style={{
        background: theme.cardBg,
        borderTop: `1px solid ${theme.border}`,
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex',
        gap: '10px',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
      }}>
        <button
          onClick={handleSummarize}
          disabled={generatingSummary}
          style={{
            flex: 1,
            padding: '14px',
            background: generatingSummary ? (darkMode ? '#3f3f5a' : '#e0e0e0') : 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
            border: 'none',
            borderRadius: '14px',
            color: generatingSummary ? theme.textSecondary : '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: generatingSummary ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', sans-serif",
            boxShadow: generatingSummary ? 'none' : '0 4px 12px rgba(255, 152, 0, 0.3)',
          }}
        >
          {generatingSummary ? '⏳ Summarizing...' : '📋 Summarize'}
        </button>
        <button
          onClick={handleFlashcards}
          disabled={generatingFlashcards}
          style={{
            flex: 1,
            padding: '14px',
            background: generatingFlashcards ? (darkMode ? '#3f3f5a' : '#e0e0e0') : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
            border: 'none',
            borderRadius: '14px',
            color: generatingFlashcards ? theme.textSecondary : '#5D4037',
            fontWeight: 700,
            fontSize: '14px',
            cursor: generatingFlashcards ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter', sans-serif",
            boxShadow: generatingFlashcards ? 'none' : '0 4px 12px rgba(255, 193, 7, 0.3)',
          }}
        >
          {generatingFlashcards ? '⏳ Generating...' : '🃏 Flashcards'}
        </button>
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowSummary(false)}
        >
          <div
            style={{
              background: theme.cardBg,
              borderRadius: '24px 24px 0 0',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '24px 20px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: theme.border, borderRadius: '2px', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 16px', color: '#E65100', fontSize: '18px', fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
              📋 Summary
            </h2>
            <div style={{
              background: darkMode ? '#3a3a2e' : '#FFF3E0',
              borderRadius: '16px',
              padding: '20px',
              lineHeight: '1.8',
              color: theme.text,
              fontSize: '15px',
              whiteSpace: 'pre-wrap',
              fontFamily: "'Inter', sans-serif",
            }}>
              {summaryText}
            </div>
            <button
              onClick={() => setShowSummary(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '16px',
                background: darkMode ? '#3f3f5a' : '#f3f4f6',
                border: 'none',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                color: theme.text,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Flashcards Modal */}
      {showFlashcards && flashcards.length > 0 && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowFlashcards(false)}
        >
          <div
            style={{
              background: theme.cardBg,
              borderRadius: '24px 24px 0 0',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '24px 20px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: theme.border, borderRadius: '2px', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#E65100', fontSize: '18px', fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
                🃏 {flashcardTitle || 'Flashcards'}
              </h2>
              <span style={{ fontSize: '14px', color: theme.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                {flashcardIndex + 1} / {flashcards.length}
              </span>
            </div>

            {/* Card */}
            <div
              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
              style={{
                background: flashcardFlipped
                  ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
                  : (darkMode ? 'linear-gradient(135deg, #2d2d4a 0%, #3f3f5a 100%)' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)'),
                borderRadius: '20px',
                padding: '40px 24px',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                animation: 'flipIn 0.3s ease-out',
                transition: 'background 0.3s',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px', fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {flashcardFlipped ? '✅ Answer' : '❓ Question'}
                </div>
                <div style={{
                  fontSize: '18px',
                  color: flashcardFlipped ? '#2E7D32' : theme.text,
                  lineHeight: '1.6',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                }}>
                  {flashcardFlipped ? flashcards[flashcardIndex].answer : flashcards[flashcardIndex].question}
                </div>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '20px', fontFamily: "'Inter', sans-serif" }}>
                  Tap to {flashcardFlipped ? 'see question' : 'reveal answer'}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => { setFlashcardIndex(Math.max(0, flashcardIndex - 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIndex === 0}
                style={{
                  flex: 1, padding: '16px', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 600, cursor: flashcardIndex === 0 ? 'not-allowed' : 'pointer',
                  background: flashcardIndex === 0 ? (darkMode ? '#2d2d4a' : '#f0f0f0') : (darkMode ? '#3f3f5a' : '#FFF8E1'),
                  color: flashcardIndex === 0 ? theme.textSecondary : theme.text,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                ← Previous
              </button>
              <button
                onClick={() => { setFlashcardIndex(Math.min(flashcards.length - 1, flashcardIndex + 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIndex === flashcards.length - 1}
                style={{
                  flex: 1, padding: '16px', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 600, cursor: flashcardIndex === flashcards.length - 1 ? 'not-allowed' : 'pointer',
                  background: flashcardIndex === flashcards.length - 1 ? (darkMode ? '#2d2d4a' : '#f0f0f0') : 'linear-gradient(135deg, #FFC107, #FFB300)',
                  color: flashcardIndex === flashcards.length - 1 ? theme.textSecondary : '#5D4037',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: flashcardIndex === flashcards.length - 1 ? 'none' : '0 4px 12px rgba(255,193,7,0.3)',
                }}
              >
                Next →
              </button>
            </div>

            <button
              onClick={() => setShowFlashcards(false)}
              style={{
                width: '100%', marginTop: '12px', padding: '14px', background: 'transparent', border: `1px solid ${theme.border}`,
                borderRadius: '14px', fontSize: '14px', cursor: 'pointer', color: theme.textSecondary, fontFamily: "'Inter', sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
