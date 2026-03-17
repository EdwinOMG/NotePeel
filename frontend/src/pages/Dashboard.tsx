import { useState, useEffect, useRef } from 'react';
import { notesAPI } from '../services/api';
import type { Note, NoteWithImage } from '../types';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
}

export default function Dashboard({ userEmail, onLogout }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteWithImage | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [fontSize, setFontSize] = useState('4');
  const [fontFamily, setFontFamily] = useState('Georgia');
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [lineSpacing, setLineSpacing] = useState('1.6');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [zoom, setZoom] = useState(100);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Update word/char count
  const updateCounts = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      setCharCount(text.length);
      setWordCount(text.split(/\s+/).filter(w => w.length > 0).length);
    }
  };

  const loadNotes = async () => {
    try {
      const data = await notesAPI.getAll();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('🍌 Peeling your notes with Gemini AI...');
    setActiveMenu(null);

    try {
      const newNote = await notesAPI.upload(file, noteType);
      setNotes([newNote, ...notes]);
      await viewNote(newNote);
      setMessage('🐵 Note peeled successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const viewNote = async (note: Note) => {
    try {
      const fullNote = await notesAPI.getById(note.id);
      setSelectedNote(fullNote);
      if (editorRef.current) {
        const content = fullNote.structured_text || fullNote.raw_text || '';
        // Check if content is already HTML
        if (content.includes('<') && content.includes('>')) {
          editorRef.current.innerHTML = content;
        } else {
          editorRef.current.innerHTML = content.replace(/\n/g, '<br>');
        }
        updateCounts();
      }
      setShowImage(false);
      setShowNotesPanel(false);
      setActiveMenu(null);
    } catch (err) {
      setMessage('Error loading note: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const saveNote = async () => {
    if (!selectedNote || !editorRef.current) return;

    try {
      const text = editorRef.current.innerHTML;
      await notesAPI.update(selectedNote.id, { structured_text: text });
      setSelectedNote({ ...selectedNote, structured_text: text });
      setMessage('🐵 Note saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const deleteNote = async (noteId: number) => {
    if (!window.confirm('Delete this note?')) return;

    try {
      await notesAPI.delete(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        if (editorRef.current) editorRef.current.innerHTML = '';
      }
      setMessage('Note deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error deleting: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const newNote = () => {
    setSelectedNote(null);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setActiveMenu(null);
    updateCounts();
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertPageBreak = () => {
    const pageBreak = '<div style="page-break-after: always; border-bottom: 2px dashed #ccc; margin: 30px 0; height: 1px;"></div><p><br></p>';
    document.execCommand('insertHTML', false, pageBreak);
    editorRef.current?.focus();
  };

  const exportToPDF = () => {
    if (!editorRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setMessage('Error: Please allow popups to export PDF');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedNote?.title || 'Note'}</title>
          <style>
            body { font-family: ${fontFamily}, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: ${lineSpacing}; }
            h1 { color: #5D4037; border-bottom: 2px solid #FFE082; padding-bottom: 10px; }
            .content { font-size: 14px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
            @media print { .page-break { page-break-after: always; } }
          </style>
        </head>
        <body>
          <h1>🐵 ${selectedNote?.title || 'Untitled Note'}</h1>
          <div class="content">${editorRef.current.innerHTML}</div>
          <div class="footer">Exported from NotePeel 🍌 on ${new Date().toLocaleDateString()}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    setActiveMenu(null);
  };

  const exportToTXT = () => {
    if (!editorRef.current) return;
    
    const text = editorRef.current.innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNote?.title || 'note'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setMessage('📄 Exported to TXT!');
    setTimeout(() => setMessage(''), 3000);
    setActiveMenu(null);
  };

  const exportToHTML = () => {
    if (!editorRef.current) return;
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>${selectedNote?.title || 'Note'}</title>
  <style>
    body { font-family: ${fontFamily}, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: ${lineSpacing}; }
    h1 { color: #5D4037; }
  </style>
</head>
<body>
  <h1>${selectedNote?.title || 'Untitled Note'}</h1>
  <div>${editorRef.current.innerHTML}</div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNote?.title || 'note'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setMessage('🌐 Exported to HTML!');
    setTimeout(() => setMessage(''), 3000);
    setActiveMenu(null);
  };

  const handleHighlight = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const parentEl = selection.anchorNode?.parentElement;
      const bgColor = parentEl?.style?.backgroundColor;
      
      if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
        execCommand('hiliteColor', 'transparent');
      } else {
        execCommand('hiliteColor', highlightColor);
      }
    }
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '8px 20px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const toolbarBtnStyle: React.CSSProperties = {
    padding: '6px 10px',
    background: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    minWidth: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab - indent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        execCommand('outdent');
      } else {
        const selection = window.getSelection();
        const parentList = selection?.anchorNode?.parentElement?.closest('ul, ol');
        if (parentList) {
          execCommand('indent');
        } else {
          document.execCommand('insertText', false, '\u00a0\u00a0\u00a0\u00a0');
        }
      }
    }
    // Ctrl+S - Save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveNote();
    }
    // Ctrl+B - Bold
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      execCommand('bold');
    }
    // Ctrl+I - Italic
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      execCommand('italic');
    }
    // Ctrl+U - Underline
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      execCommand('underline');
    }
    // Ctrl+H - Highlight
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      handleHighlight();
    }
    // Ctrl+Enter - Page break
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      insertPageBreak();
    }
    // Ctrl+Shift+L - Bullet list
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      execCommand('insertUnorderedList');
    }
    // Ctrl+Shift+N - Numbered list
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      execCommand('insertOrderedList');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#f0f0f0' }}>
      {/* Title Bar */}
      <div style={{
        background: 'linear-gradient(180deg, #FFC107 0%, #FF9800 100%)',
        padding: '8px 15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🐵🍌</span>
          <span style={{ fontWeight: 'bold', color: '#5D4037', fontSize: '14px' }}>
            NotePeel - {selectedNote?.title || 'Untitled'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '12px', color: '#5D4037' }}>{userEmail}</span>
          <button
            onClick={onLogout}
            style={{ background: 'rgba(255,255,255,0.3)', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#5D4037' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', padding: '2px 10px', position: 'relative' }}>
        {/* File Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'file' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => fileInputRef.current?.click()}>
                <span>📷 Upload New Note</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+U</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={newNote}>
                <span>📄 New Blank Note</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+N</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setShowNotesPanel(true); setActiveMenu(null); }}>
                <span>📁 Open Note...</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+O</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={saveNote}>
                <span>💾 Save</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+S</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={exportToPDF}>
                <span>📄 Export as PDF</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={exportToTXT}>
                <span>📝 Export as TXT</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={exportToHTML}>
                <span>🌐 Export as HTML</span>
              </div>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'edit' ? null : 'edit'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'edit' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '200px', zIndex: 1000 }}>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('undo'); setActiveMenu(null); }}>
                <span>↩️ Undo</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+Z</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('redo'); setActiveMenu(null); }}>
                <span>↪️ Redo</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+Y</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('selectAll'); setActiveMenu(null); }}>
                <span>🔲 Select All</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+A</span>
              </div>
            </div>
          )}
        </div>

        {/* Insert Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'insert' ? null : 'insert'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'insert' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Insert
          </button>
          {activeMenu === 'insert' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { insertPageBreak(); setActiveMenu(null); }}>
                <span>📃 Page Break</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+Enter</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('insertHorizontalRule'); setActiveMenu(null); }}>
                <span>➖ Horizontal Line</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('insertUnorderedList'); setActiveMenu(null); }}>
                <span>• Bullet List</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+Shift+L</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('insertOrderedList'); setActiveMenu(null); }}>
                <span>1. Numbered List</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+Shift+N</span>
              </div>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'view' ? null : 'view'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'view' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setShowImage(!showImage); setActiveMenu(null); }}>
                <span>{showImage ? '✓ ' : ''}📷 Original Image</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setShowNotesPanel(!showNotesPanel); setActiveMenu(null); }}>
                <span>{showNotesPanel ? '✓ ' : ''}📁 Notes Panel</span>
              </div>
            </div>
          )}
        </div>

        {/* Format Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'format' ? null : 'format'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'format' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Format
          </button>
          {activeMenu === 'format' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('bold'); setActiveMenu(null); }}>
                <span><b>B</b> Bold</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+B</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('italic'); setActiveMenu(null); }}>
                <span><i>I</i> Italic</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+I</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('underline'); setActiveMenu(null); }}>
                <span><u>U</u> Underline</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+U</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('strikeThrough'); setActiveMenu(null); }}>
                <span><s>S</s> Strikethrough</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { handleHighlight(); setActiveMenu(null); }}>
                <span style={{ background: highlightColor, padding: '0 4px' }}>H</span>
                <span> Highlight</span>
                <span style={{ color: '#888', fontSize: '11px' }}>Ctrl+H</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('justifyLeft'); setActiveMenu(null); }}>
                <span>⬅️ Align Left</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('justifyCenter'); setActiveMenu(null); }}>
                <span>↔️ Align Center</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { execCommand('justifyRight'); setActiveMenu(null); }}>
                <span>➡️ Align Right</span>
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle, fontWeight: lineSpacing === '1' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setLineSpacing('1'); setActiveMenu(null); }}>
                <span>{lineSpacing === '1' ? '✓ ' : ''}Single Spacing</span>
              </div>
              <div style={{...menuItemStyle, fontWeight: lineSpacing === '1.6' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setLineSpacing('1.6'); setActiveMenu(null); }}>
                <span>{lineSpacing === '1.6' ? '✓ ' : ''}1.5 Spacing</span>
              </div>
              <div style={{...menuItemStyle, fontWeight: lineSpacing === '2' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setLineSpacing('2'); setActiveMenu(null); }}>
                <span>{lineSpacing === '2' ? '✓ ' : ''}Double Spacing</span>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Toolbar */}
      <div style={{ background: '#f8f8f8', borderBottom: '1px solid #ddd', padding: '8px 15px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Note Type Selector */}
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as 'default' | 'lecture' | 'meeting')}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', background: '#FFF8E1' }}
          title="Note type for Gemini AI"
        >
          <option value="default">📝 Default</option>
          <option value="lecture">📚 Lecture</option>
          <option value="meeting">📋 Meeting</option>
        </select>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Font Family */}
        <select
          value={fontFamily}
          onChange={(e) => { setFontFamily(e.target.value); execCommand('fontName', e.target.value); }}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minWidth: '130px' }}
        >
          <option value="Georgia">Georgia</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
        </select>

        {/* Font Size */}
        <select
          value={fontSize}
          onChange={(e) => { setFontSize(e.target.value); execCommand('fontSize', e.target.value); }}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', width: '65px' }}
        >
          <option value="1">8</option>
          <option value="2">10</option>
          <option value="3">12</option>
          <option value="4">14</option>
          <option value="5">18</option>
          <option value="6">24</option>
          <option value="7">36</option>
        </select>

        {/* Line Spacing */}
        <select
          value={lineSpacing}
          onChange={(e) => setLineSpacing(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', width: '75px' }}
          title="Line Spacing"
        >
          <option value="1">1.0</option>
          <option value="1.6">1.5</option>
          <option value="2">2.0</option>
        </select>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Text Formatting */}
        <button style={toolbarBtnStyle} onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"><b>B</b></button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"><i>I</i></button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('strikeThrough')} title="Strikethrough"><s>S</s></button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Text Color */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', marginRight: '4px' }}>A</span>
          <input
            type="color"
            onChange={(e) => execCommand('foreColor', e.target.value)}
            style={{ width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
            title="Text Color"
          />
        </div>

        {/* Highlight Button + Color Picker */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={handleHighlight}
            style={{ ...toolbarBtnStyle, background: highlightColor, fontWeight: 'bold', minWidth: '28px' }}
            title="Highlight (Ctrl+H)"
          >
            H
          </button>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            style={{ width: '20px', height: '28px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '1px' }}
            title="Change Highlight Color"
          />
        </div>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Alignment */}
        <button style={toolbarBtnStyle} onClick={() => execCommand('justifyLeft')} title="Align Left">⬅</button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('justifyCenter')} title="Align Center">⬌</button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('justifyRight')} title="Align Right">➡</button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Lists */}
        <button style={toolbarBtnStyle} onClick={() => execCommand('insertUnorderedList')} title="Bullet List (Ctrl+Shift+L)">•</button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('insertOrderedList')} title="Numbered List (Ctrl+Shift+N)">1.</button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Indent */}
        <button style={toolbarBtnStyle} onClick={() => execCommand('outdent')} title="Decrease Indent (Shift+Tab)">⇤</button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('indent')} title="Increase Indent (Tab)">⇥</button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Undo/Redo */}
        <button style={toolbarBtnStyle} onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)">↩</button>
        <button style={toolbarBtnStyle} onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)">↪</button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* Zoom Controls */}
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', background: 'white', width: '65px' }} title="Zoom">
          <option value={25}>25%</option>
          <option value={50}>50%</option>
          <option value={75}>75%</option>
          <option value={100}>100%</option>
          <option value={125}>125%</option>
          <option value={150}>150%</option>
        </select>
        <button style={toolbarBtnStyle} onClick={() => setZoom(Math.min(150, zoom + 25))} title="Zoom In">+</button>
        <button style={toolbarBtnStyle} onClick={() => setZoom(Math.max(25, zoom - 25))} title="Zoom Out">−</button>

        <div style={{ flex: 1 }} />

        {/* Save Button */}
        <button
          onClick={saveNote}
          disabled={!selectedNote}
          style={{
            padding: '6px 16px',
            background: selectedNote ? 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)' : '#ccc',
            color: '#5D4037',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedNote ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >
          💾 Save
        </button>
      </div>

      {/* Message Bar */}
      {message && (
        <div style={{
          padding: '8px 15px',
          background: message.includes('Error') ? '#ffebee' : '#FFF8E1',
          color: message.includes('Error') ? '#c62828' : '#5D4037',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <span>{uploading ? '🍌 Peeling...' : message}</span>
          <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Notes Panel (toggleable) */}
        {showNotesPanel && (
          <div style={{ width: '250px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#5D4037', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📁 Your Notes ({notes.length})</span>
              <button onClick={() => setShowNotesPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {loading ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '10px' }}>Loading...</p>
              ) : notes.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '10px' }}>No notes yet. Upload one!</p>
              ) : (
                notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => viewNote(note)}
                    style={{
                      padding: '10px',
                      marginBottom: '6px',
                      background: selectedNote?.id === note.id ? '#FFF8E1' : '#f9f9f9',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: selectedNote?.id === note.id ? '1px solid #FFB74D' : '1px solid #eee',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                          {new Date(note.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        style={{ background: '#ff5252', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px', marginLeft: '8px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Image Panel (toggleable) */}
        {showImage && selectedNote && (
          <div style={{ width: '350px', background: '#f5f5f5', borderRight: '1px solid #ddd', padding: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#5D4037' }}>📷 Original Image</h3>
              <button onClick={() => setShowImage(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            {selectedNote.image_base64 && (
              <img
                src={`data:${selectedNote.image_mimetype};base64,${selectedNote.image_base64}`}
                alt="Note"
                style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd' }}
              />
            )}
          </div>
        )}

        {/* Editor Area */}
        <div style={{ flex: 1, background: '#e0e0e0', padding: '30px', overflowY: 'auto' }}>
          <div style={{
            maxWidth: '850px',
            margin: '0 auto',
            background: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            minHeight: '1100px',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}>
            {/* Paper - auto-expanding */}
            <div
              ref={editorRef}
              contentEditable
              style={{
                padding: '60px 80px',
                minHeight: '1000px',
                fontSize: '16px',
                fontFamily: fontFamily,
                lineHeight: lineSpacing,
                outline: 'none',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal',
              }}
              onKeyDown={handleKeyDown}
              onInput={updateCounts}
              suppressContentEditableWarning
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        background: '#f0f0f0',
        borderTop: '1px solid #ddd',
        padding: '4px 15px',
        fontSize: '12px',
        color: '#666',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>{selectedNote ? `Editing: ${selectedNote.title || 'Untitled'}` : 'No note selected - Use File → Upload New Note to get started'}</span>
        <span>{charCount} characters • {wordCount} words • {zoom}% | Gemini AI 🐵🍌</span>
      </div>
    </div>
  );
}
