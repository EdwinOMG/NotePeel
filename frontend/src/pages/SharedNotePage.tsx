import { useState, useEffect } from 'react';
import { notesAPI } from '../services/api';
import type { SharedNote } from '../types';

interface SharedNotePageProps {
  token: string;
}

export default function SharedNotePage({ token }: SharedNotePageProps) {
  const [note, setNote] = useState<SharedNote | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notesAPI.getShared(token)
      .then(setNote)
      .catch(() => setError('This shared note is no longer available.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', color: '#5D4037' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', color: '#5D4037' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>404</div>
          <div style={{ fontSize: '18px' }}>{error || 'Note not found'}</div>
        </div>
      </div>
    );
  }

  const tags = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)', fontFamily: 'Georgia, serif' }}>
      {/* Header bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📝</span>
          <span style={{ fontWeight: 'bold', color: '#5D4037', fontSize: '16px' }}>NotePeel</span>
        </div>
        <div style={{ fontSize: '13px', color: '#888' }}>
          Shared by <strong style={{ color: '#5D4037' }}>{note.owner_username || 'a NotePeel user'}</strong>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Title section */}
          <div style={{ padding: '24px 30px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <h1 style={{ margin: '0 0 8px', color: '#333', fontSize: '24px', fontWeight: '600' }}>
              {note.title || 'Untitled Note'}
            </h1>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: '#888' }}>
              {note.subject && <span>Subject: <strong style={{ color: '#5D4037' }}>{note.subject}</strong></span>}
              {note.topic && <span>Topic: <strong style={{ color: '#5D4037' }}>{note.topic}</strong></span>}
              <span>{new Date(note.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                {tags.map((tag, i) => (
                  <span key={i} style={{ background: '#FFF3E0', color: '#E65100', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Note content */}
          <div
            style={{ padding: '24px 30px 40px', lineHeight: '1.75', color: '#333', fontSize: '15px' }}
            dangerouslySetInnerHTML={{ __html: note.structured_text || note.raw_text || '<em>No content</em>' }}
          />
        </div>
      </div>
    </div>
  );
}
