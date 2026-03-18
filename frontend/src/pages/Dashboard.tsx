import { useState, useEffect, useRef } from 'react';
import { notesAPI } from '../services/api';
import type { Note, NoteWithImage, Categories } from '../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<{question: string; answer: string}[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [flashcardTitle, setFlashcardTitle] = useState('');
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [categories, setCategories] = useState<Categories>({ subjects: [], topics: [], tags: [] });
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showNoteInfo, setShowNoteInfo] = useState(false);
  const [folderMenuNote, setFolderMenuNote] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editTags, setEditTags] = useState('');
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

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNotes(notes);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await notesAPI.search(searchQuery);
        setFilteredNotes(results);
      } catch {
        setFilteredNotes(notes.filter(n =>
          (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.tags || '').toLowerCase().includes(searchQuery.toLowerCase())
        ));
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, notes]);

  const loadNotes = async () => {
    try {
      const data = await notesAPI.getAll();
      setNotes(data);
      setFilteredNotes(data);
      // Load categories
      try {
        const cats = await notesAPI.getCategories();
        setCategories(cats);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply subject/tag filters
  useEffect(() => {
    if (!activeSubjectFilter && !activeTagFilter) {
      return; // search effect handles default filtering
    }
    let filtered = notes;
    if (activeSubjectFilter) {
      filtered = filtered.filter(n => n.subject === activeSubjectFilter);
    }
    if (activeTagFilter) {
      filtered = filtered.filter(n => n.tags && n.tags.toLowerCase().includes(activeTagFilter.toLowerCase()));
    }
    setFilteredNotes(filtered);
  }, [activeSubjectFilter, activeTagFilter, notes]);

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
      setEditSubject(fullNote.subject || '');
      setEditTopic(fullNote.topic || '');
      setEditTags(fullNote.tags || '');
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

  const handleGenerateFlashcards = async () => {
    if (!selectedNote) return;
    setGeneratingFlashcards(true);
    setMessage('Generating flashcards with AI...');
    try {
      const result = await notesAPI.generateFlashcards(selectedNote.id);
      setFlashcards(result.cards);
      setFlashcardTitle(result.title);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setShowFlashcards(true);
      setMessage('');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to generate flashcards'));
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedNote) return;
    setGeneratingSummary(true);
    setMessage('Generating summary with AI...');
    try {
      const result = await notesAPI.summarize(selectedNote.id);
      setSummaryText(result.summary);
      setShowSummary(true);
      setMessage('');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to summarize'));
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleExplain = async () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) {
      setMessage('Select some text first, then click Explain.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setGeneratingExplanation(true);
    setMessage('Getting AI explanation...');
    try {
      const result = await notesAPI.explain(text);
      setExplanationText(result.explanation);
      setShowExplanation(true);
      setMessage('');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to explain'));
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const assignFolder = async (noteId: number, folder: string) => {
    try {
      await notesAPI.update(noteId, { subject: folder || undefined });
      setNotes(notes.map(n => n.id === noteId ? { ...n, subject: folder } : n));
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, subject: folder } as NoteWithImage);
        setEditSubject(folder);
      }
      const cats = await notesAPI.getCategories();
      setCategories(cats);
    } catch { /* ignore */ }
    setFolderMenuNote(null);
  };

  const saveNoteMetadata = async () => {
    if (!selectedNote) return;
    try {
      await notesAPI.update(selectedNote.id, {
        subject: editSubject || undefined,
        topic: editTopic || undefined,
        tags: editTags || undefined,
      });
      // Update local state
      setSelectedNote({ ...selectedNote, subject: editSubject, topic: editTopic, tags: editTags } as NoteWithImage);
      setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, subject: editSubject, topic: editTopic, tags: editTags } : n));
      setMessage('Note info saved!');
      setTimeout(() => setMessage(''), 2000);
      // Refresh categories
      try {
        const cats = await notesAPI.getCategories();
        setCategories(cats);
      } catch { /* ignore */ }
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to save'));
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
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setShowNoteInfo(!showNoteInfo); setActiveMenu(null); }}>
                <span>{showNoteInfo ? '✓ ' : ''}🏷️ Note Info Panel</span>
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

        {/* AI Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'ai' ? null : 'ai'); }}
            style={{ padding: '6px 12px', background: activeMenu === 'ai' ? '#e0e0e0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#E65100' }}
          >
            AI Tools
          </button>
          {activeMenu === 'ai' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '240px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: selectedNote ? '#333' : '#ccc'}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { if (selectedNote) { handleGenerateFlashcards(); setActiveMenu(null); } }}>
                <span>🃏 Generate Flashcards</span>
                {generatingFlashcards && <span style={{ fontSize: '11px', color: '#888' }}>...</span>}
              </div>
              <div style={{...menuItemStyle, color: selectedNote ? '#333' : '#ccc'}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { if (selectedNote) { handleSummarize(); setActiveMenu(null); } }}>
                <span>📋 Summarize Note</span>
                {generatingSummary && <span style={{ fontSize: '11px', color: '#888' }}>...</span>}
              </div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { handleExplain(); setActiveMenu(null); }}>
                <span>💡 Explain Selection</span>
                {generatingExplanation && <span style={{ fontSize: '11px', color: '#888' }}>...</span>}
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

        {/* AI Quick Buttons */}
        <button
          onClick={handleGenerateFlashcards}
          disabled={!selectedNote || generatingFlashcards}
          style={{
            padding: '6px 12px',
            background: selectedNote ? '#E3F2FD' : '#f0f0f0',
            color: selectedNote ? '#1565C0' : '#aaa',
            border: '1px solid ' + (selectedNote ? '#90CAF9' : '#ddd'),
            borderRadius: '4px',
            cursor: selectedNote ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
          title="Generate Flashcards"
        >
          {generatingFlashcards ? '...' : '🃏 Flashcards'}
        </button>
        <button
          onClick={handleSummarize}
          disabled={!selectedNote || generatingSummary}
          style={{
            padding: '6px 12px',
            background: selectedNote ? '#E8F5E9' : '#f0f0f0',
            color: selectedNote ? '#2E7D32' : '#aaa',
            border: '1px solid ' + (selectedNote ? '#A5D6A7' : '#ddd'),
            borderRadius: '4px',
            cursor: selectedNote ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
          title="Summarize Note"
        >
          {generatingSummary ? '...' : '📋 Summary'}
        </button>
        <button
          onClick={handleExplain}
          disabled={generatingExplanation}
          style={{
            padding: '6px 12px',
            background: '#FFF3E0',
            color: '#E65100',
            border: '1px solid #FFCC80',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
          title="Explain selected text"
        >
          {generatingExplanation ? '...' : '💡 Explain'}
        </button>

        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

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
          <div style={{ width: '280px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#5D4037', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Your Notes ({filteredNotes.length})</span>
              <button onClick={() => setShowNotesPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            {/* Search Bar */}
            <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '20px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#f9f9f9',
                  }}
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#888' }}
                  >
                    ✕
                  </button>
                ) : (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#aaa', pointerEvents: 'none' }}>
                    🔍
                  </span>
                )}
              </div>
              {isSearching && <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', textAlign: 'center' }}>Searching...</div>}
            </div>

            {/* Category Filters */}
            {(categories.subjects.length > 0 || categories.tags.length > 0) && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee', maxHeight: '140px', overflowY: 'auto' }}>
                {categories.subjects.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>📁 Folders</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { setActiveSubjectFilter(null); setActiveTagFilter(null); }}
                        style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: '1px solid #ddd', cursor: 'pointer',
                          background: !activeSubjectFilter ? '#FF9800' : 'white',
                          color: !activeSubjectFilter ? 'white' : '#666',
                        }}
                      >
                        All
                      </button>
                      {categories.subjects.map(sub => (
                        <button
                          key={sub}
                          onClick={() => { setActiveSubjectFilter(activeSubjectFilter === sub ? null : sub); setSearchQuery(''); }}
                          style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FFE082', cursor: 'pointer',
                            background: activeSubjectFilter === sub ? '#FFC107' : '#FFF8E1',
                            color: activeSubjectFilter === sub ? '#5D4037' : '#F57F17',
                            fontWeight: activeSubjectFilter === sub ? 'bold' : 'normal',
                          }}
                        >
                          📁 {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {categories.tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Tags</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {categories.tags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => { setActiveTagFilter(activeTagFilter === tag ? null : tag); setSearchQuery(''); }}
                          style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: '1px solid #90CAF9', cursor: 'pointer',
                            background: activeTagFilter === tag ? '#1565C0' : '#E3F2FD',
                            color: activeTagFilter === tag ? 'white' : '#1565C0',
                            fontWeight: activeTagFilter === tag ? 'bold' : 'normal',
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {loading ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '10px' }}>Loading...</p>
              ) : filteredNotes.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '10px' }}>
                  {searchQuery ? 'No notes match your search.' : 'No notes yet. Upload one!'}
                </p>
              ) : (
                filteredNotes.map(note => (
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
                        {(note.subject || note.tags) && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {note.subject && (
                              <span style={{ fontSize: '10px', background: '#FFF8E1', color: '#F57F17', padding: '1px 6px', borderRadius: '10px', border: '1px solid #FFE082' }}>
                                📁 {note.subject}
                              </span>
                            )}
                            {note.tags && note.tags.split(',').slice(0, 2).map((tag, i) => (
                              <span key={i} style={{ fontSize: '10px', background: '#E3F2FD', color: '#1565C0', padding: '1px 6px', borderRadius: '10px', border: '1px solid #90CAF9' }}>
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ position: 'relative', marginLeft: '4px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFolderMenuNote(folderMenuNote === note.id ? null : note.id); }}
                          title="Move to folder"
                          style={{ background: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}
                        >
                          📁
                        </button>
                        {folderMenuNote === note.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '140px', padding: '4px 0' }}>
                            <div style={{ fontSize: '10px', color: '#888', padding: '4px 10px', borderBottom: '1px solid #eee' }}>Move to folder</div>
                            <div
                              onClick={() => assignFolder(note.id, '')}
                              style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', color: '#666' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                            >
                              — None
                            </div>
                            {categories.subjects.map(sub => (
                              <div
                                key={sub}
                                onClick={() => assignFolder(note.id, sub)}
                                style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: note.subject === sub ? 'bold' : 'normal', color: '#333' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF8E1')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                              >
                                📁 {sub}
                              </div>
                            ))}
                            <div style={{ borderTop: '1px solid #eee', padding: '4px 10px' }}>
                              <input
                                type="text"
                                placeholder="New folder..."
                                style={{ width: '100%', fontSize: '11px', padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) assignFolder(note.id, e.currentTarget.value.trim()); }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        style={{ background: '#ff5252', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px', marginLeft: '4px' }}
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

        {/* Note Info Panel */}
        {showNoteInfo && selectedNote && (
          <div style={{ width: '240px', background: 'white', borderRight: '1px solid #ddd', padding: '15px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#5D4037' }}>🏷️ Note Info</h3>
              <button onClick={() => setShowNoteInfo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>📁 Folder</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="e.g. Biology, Math..."
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Topic</label>
              <input
                type="text"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                placeholder="e.g. Cell Division..."
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tags (comma-separated)</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. midterm, chapter3..."
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={saveNoteMetadata}
              style={{
                width: '100%',
                padding: '8px',
                background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                color: '#5D4037',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Save Info
            </button>

            {/* Quick info display */}
            <div style={{ marginTop: '20px', padding: '12px', background: '#f9f9f9', borderRadius: '8px', fontSize: '12px', color: '#666' }}>
              <div style={{ marginBottom: '4px' }}><strong>Created:</strong> {new Date(selectedNote.created_at).toLocaleString()}</div>
              <div style={{ marginBottom: '4px' }}><strong>Status:</strong> {selectedNote.status}</div>
              {selectedNote.image_filename && <div><strong>File:</strong> {selectedNote.image_filename}</div>}
            </div>

            {/* Tag chips preview */}
            {editTags && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>Tags Preview</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {editTags.split(',').map((tag, i) => (
                    tag.trim() && <span key={i} style={{ fontSize: '11px', background: '#E3F2FD', color: '#1565C0', padding: '2px 8px', borderRadius: '10px', border: '1px solid #90CAF9' }}>
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
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

      {/* ── Flashcard Modal ── */}
      {showFlashcards && flashcards.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowFlashcards(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#5D4037', fontSize: '18px' }}>🃏 {flashcardTitle}</h2>
              <button onClick={() => setShowFlashcards(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            {/* Progress bar */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '20px' }}>
              {flashcards.map((_, i) => (
                <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= flashcardIndex ? '#FF9800' : '#eee', transition: 'background 0.3s' }} />
              ))}
            </div>

            {/* Card */}
            <div
              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
              style={{
                minHeight: '200px',
                background: flashcardFlipped ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)' : 'linear-gradient(135deg, #FFF8E1 0%, #FFE082 100%)',
                borderRadius: '12px',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid ' + (flashcardFlipped ? '#A5D6A7' : '#FFB74D'),
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '12px' }}>
                {flashcardFlipped ? 'ANSWER' : 'QUESTION'} — Card {flashcardIndex + 1}/{flashcards.length}
              </div>
              <div style={{ fontSize: '18px', lineHeight: '1.6', color: '#333', fontWeight: flashcardFlipped ? 'normal' : '500' }}>
                {flashcardFlipped ? flashcards[flashcardIndex].answer : flashcards[flashcardIndex].question}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '16px' }}>
                Click to {flashcardFlipped ? 'see question' : 'reveal answer'}
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center' }}>
              <button
                onClick={() => { setFlashcardIndex(Math.max(0, flashcardIndex - 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIndex === 0}
                style={{ padding: '8px 20px', border: '1px solid #ddd', borderRadius: '8px', background: flashcardIndex === 0 ? '#f5f5f5' : 'white', cursor: flashcardIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
              >
                Previous
              </button>
              <span style={{ color: '#888', fontSize: '13px' }}>{flashcardIndex + 1} / {flashcards.length}</span>
              <button
                onClick={() => { setFlashcardIndex(Math.min(flashcards.length - 1, flashcardIndex + 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIndex === flashcards.length - 1}
                style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: flashcardIndex === flashcards.length - 1 ? '#ccc' : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)', color: '#5D4037', cursor: flashcardIndex === flashcards.length - 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Modal ── */}
      {showSummary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowSummary(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '30px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2E7D32', fontSize: '18px' }}>📋 AI Summary</h2>
              <button onClick={() => setShowSummary(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ background: '#E8F5E9', borderRadius: '12px', padding: '24px', lineHeight: '1.8', color: '#333', fontSize: '15px', whiteSpace: 'pre-wrap' }}>
              {summaryText}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summaryText);
                  setMessage('Summary copied to clipboard!');
                  setTimeout(() => setMessage(''), 2000);
                }}
                style={{ padding: '8px 20px', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#2E7D32' }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Explanation Modal ── */}
      {showExplanation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowExplanation(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#E65100', fontSize: '18px' }}>💡 AI Explanation</h2>
              <button onClick={() => setShowExplanation(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>
            <div style={{ background: '#FFF3E0', borderRadius: '12px', padding: '24px', lineHeight: '1.8', color: '#333', fontSize: '15px', whiteSpace: 'pre-wrap' }}>
              {explanationText}
            </div>
          </div>
        </div>
      )}

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
