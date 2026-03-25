import { useState, useEffect, useRef } from 'react';
import { notesAPI } from '../services/api';
import type { Note, NoteWithImage, Categories } from '../types';
import { getUploadFeedback, prepareContentForDisplay } from '../utils/noteExtraction';
import ProfileMenu from '../components/ProfileMenu';

const getNotebookContrastColor = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.45 ? '#1a1a1a' : '#ffffff';
};

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  onOpenSettings: () => void;
  initialNoteId?: number;
  notebookId?: number;
  notebookColor?: string;
  onBack?: () => void;
  darkMode?: boolean;
}

export default function Dashboard({ userEmail, onLogout, onOpenSettings, initialNoteId, notebookId, notebookColor, onBack, darkMode = false }: DashboardProps) {
  const TABLE_PICKER_MAX_ROWS = 8;
  const TABLE_PICKER_MAX_COLS = 10;
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
  
  // AI Features state
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
  const [explanationHighlight, setExplanationHighlight] = useState('');
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [currentHighlights, setCurrentHighlights] = useState<string[]>([]);
  const [cachedExplanations, setCachedExplanations] = useState<{id: number; highlighted_text: string; explanation: string; created_at: string}[]>([]);
  const [categories, setCategories] = useState<Categories>({ subjects: [], topics: [], tags: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNoteInfo, setShowNoteInfo] = useState(false);
  const [dismissedFailedBanner, setDismissedFailedBanner] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [folderMenuNote, setFolderMenuNote] = useState<number | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPeelingModal, setShowPeelingModal] = useState(false);
  const [tablePickerSize, setTablePickerSize] = useState({ rows: 0, cols: 0 });
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoveredTopMenu, setHoveredTopMenu] = useState<string | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const tablePickerCloseTimeoutRef = useRef<number | null>(null);

  // Theme colors
  const theme = {
    bg: darkMode ? '#1C1917' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#292524' : '#ffffff',
    headerBg: darkMode ? '#211F1C' : '#ffffff',
    editorBg: darkMode ? '#292524' : '#ffffff',
    text: darkMode ? '#F5F0E8' : '#333333',
    textSecondary: darkMode ? '#A8A29E' : '#666666',
    border: darkMode ? '#44403C' : '#ddd',
    menuBg: darkMode ? '#292524' : '#ffffff',
    menuHover: darkMode ? '#3C3836' : '#f5f5f5',
    toolbarBg: darkMode ? '#211F1C' : '#f8f8f8',
    statusBar: darkMode ? '#292524' : '#f0f0f0',
    inputBg: darkMode ? '#1C1917' : '#ffffff',
  };

  useEffect(() => {
    loadNotes();
  }, []);

  // Load initial note if provided (when coming from notebook view)
  useEffect(() => {
    if (initialNoteId && !loading) {
      loadInitialNote();
    }
  }, [initialNoteId, loading]);

  const loadInitialNote = async () => {
    if (!initialNoteId) return;
    try {
      const fullNote = await notesAPI.getById(initialNoteId);
      setSelectedNote(fullNote);
      if (editorRef.current) {
        const content = fullNote.structured_text || fullNote.raw_text || '';
        if (content.includes('<') && content.includes('>')) {
          editorRef.current.innerHTML = prepareContentForDisplay(content, darkMode);
        } else {
          editorRef.current.innerHTML = prepareContentForDisplay(content.replace(/\n/g, '<br>'), darkMode);
        }
        updateCounts();
      }
    } catch (err) {
      setMessage('Error loading note: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeMenu !== 'insert') {
      if (tablePickerCloseTimeoutRef.current) {
        window.clearTimeout(tablePickerCloseTimeoutRef.current);
        tablePickerCloseTimeoutRef.current = null;
      }
      setShowTablePicker(false);
      setTablePickerSize({ rows: 0, cols: 0 });
    }
  }, [activeMenu]);

  useEffect(() => () => {
    if (tablePickerCloseTimeoutRef.current) {
      window.clearTimeout(tablePickerCloseTimeoutRef.current);
    }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowPeelingModal(true);
    setActiveMenu(null);

    try {
      const newNote = await notesAPI.upload(file, noteType);
      setNotes([newNote, ...notes]);
      await viewNote(newNote);
      const feedback = getUploadFeedback(newNote);
      setMessage(feedback.message);
      setTimeout(() => setMessage(''), feedback.timeoutMs);
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      setShowPeelingModal(false);
      e.target.value = '';
    }
  };

  const viewNote = async (note: Note) => {
    try {
      const fullNote = await notesAPI.getById(note.id);
      setSelectedNote(fullNote);
      setDismissedFailedBanner(false);
      if (editorRef.current) {
        const content = fullNote.structured_text || fullNote.raw_text || '';
        // Check if content is already HTML
        if (content.includes('<') && content.includes('>')) {
          editorRef.current.innerHTML = prepareContentForDisplay(content, darkMode);
        } else {
          editorRef.current.innerHTML = prepareContentForDisplay(content.replace(/\n/g, '<br>'), darkMode);
        }
        updateCounts();
      }
      setShowImage(false);
      setShowNotesPanel(false);
      setActiveMenu(null);
      setEditSubject(fullNote.subject || '');
      setEditTopic(fullNote.topic || '');
      setEditTags(fullNote.tags || '');
      setEditTitle(fullNote.title || '');
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

  const isNodeInsideEditor = (node: Node | null) => {
    if (!node || !editorRef.current) return false;
    return node === editorRef.current || editorRef.current.contains(node);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!isNodeInsideEditor(range.commonAncestorContainer)) return;

    savedSelectionRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    if (!editorRef.current) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    editorRef.current.focus();

    if (savedSelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current.cloneRange());
      return true;
    }

    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedSelectionRef.current = range.cloneRange();
    return true;
  };

  const insertHTMLAtCursor = (html: string) => {
    if (!editorRef.current) return;

    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const fragment = template.content;
    const lastNode = fragment.lastChild;

    range.insertNode(fragment);

    const nextRange = document.createRange();
    if (lastNode) {
      nextRange.setStartAfter(lastNode);
    } else {
      nextRange.selectNodeContents(editorRef.current);
      nextRange.collapse(false);
    }
    nextRange.collapse(true);

    selection.removeAllRanges();
    selection.addRange(nextRange);
    savedSelectionRef.current = nextRange.cloneRange();
    editorRef.current.focus();
    updateCounts();
  };

  const escapeHTML = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const execCommand = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    editorRef.current?.focus();
    updateCounts();
  };

  const insertPageBreak = () => {
    const pageBreak = '<div style="page-break-after: always; border-bottom: 2px dashed #ccc; margin: 30px 0; height: 1px;"></div><p><br></p>';
    insertHTMLAtCursor(pageBreak);
  };

  const insertTable = (rows: number, cols: number) => {
    const borderColor = darkMode ? '#555' : '#ccc';
    let html = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const cellStyle = `border: 1px solid ${borderColor}; padding: 8px 12px; min-width: 60px;${r === 0 ? ' font-weight: bold; background: ' + (darkMode ? '#211F1C' : '#f5f5f5') + ';' : ''}`;
        html += `<td style="${cellStyle}">${r === 0 ? 'Header' : '&nbsp;'}</td>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    insertHTMLAtCursor(html);
    setTablePickerSize({ rows: 0, cols: 0 });
  };

  const insertLink = () => {
    const selectedText = savedSelectionRef.current?.toString() || window.getSelection()?.toString() || '';
    const url = prompt('Enter URL:', 'https://');
    if (!url) return;
    const text = selectedText || prompt('Enter link text:', url) || url;
    const linkHTML = `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" style="color: #1565C0; text-decoration: underline;">${escapeHTML(text)}</a>`;
    insertHTMLAtCursor(linkHTML);
  };

  const openTablePicker = () => {
    if (tablePickerCloseTimeoutRef.current) {
      window.clearTimeout(tablePickerCloseTimeoutRef.current);
      tablePickerCloseTimeoutRef.current = null;
    }
    setShowTablePicker(true);
  };

  const closeTablePickerSoon = () => {
    if (tablePickerCloseTimeoutRef.current) {
      window.clearTimeout(tablePickerCloseTimeoutRef.current);
    }
    tablePickerCloseTimeoutRef.current = window.setTimeout(() => {
      setShowTablePicker(false);
      setTablePickerSize({ rows: 0, cols: 0 });
      tablePickerCloseTimeoutRef.current = null;
    }, 180);
  };

  const handleTopMenuHover = (menu: string) => {
    setHoveredTopMenu(menu);
    if (activeMenu && activeMenu !== menu) {
      setActiveMenu(menu);
    }
  };

  const getTopMenuButtonStyle = (
    menu: string,
    options?: { color?: string; fontWeight?: React.CSSProperties['fontWeight'] }
  ): React.CSSProperties => {
    const isActive = activeMenu === menu;
    const isHovered = hoveredTopMenu === menu;

    return {
      padding: '8px 14px',
      background: isActive ? theme.menuHover : isHovered ? (darkMode ? 'rgba(255,255,255,0.06)' : '#f7f3eb') : 'transparent',
      border: 'none',
      borderRadius: '8px 8px 0 0',
      cursor: 'pointer',
      fontSize: '13px',
      color: options?.color ?? theme.text,
      fontWeight: options?.fontWeight ?? 500,
      boxShadow: isActive || isHovered ? `inset 0 -2px 0 ${darkMode ? '#FFB74D' : '#F57C00'}` : 'none',
      transition: 'background 0.14s ease, box-shadow 0.14s ease, color 0.14s ease',
    };
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

  // Save note title
  const saveTitle = async () => {
    if (!selectedNote || !editTitle.trim()) return;
    try {
      await notesAPI.update(selectedNote.id, { title: editTitle.trim() });
      setSelectedNote({ ...selectedNote, title: editTitle.trim() });
      setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title: editTitle.trim() } : n));
      setMessage('Title saved!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      console.error('Failed to save title:', err);
      setMessage('Failed to save title');
    }
  };

  // Save note metadata (subject, topic, tags)
  const saveNoteMetadata = async () => {
    if (!selectedNote) return;
    try {
      setMessage('Saving note info...');
      await notesAPI.update(selectedNote.id, {
        title: editTitle,
        subject: editSubject,
        topic: editTopic,
        tags: editTags
      });
      // Update local state
      setSelectedNote({ ...selectedNote, title: editTitle, subject: editSubject, topic: editTopic, tags: editTags });
      setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title: editTitle, subject: editSubject, topic: editTopic, tags: editTags } : n));
      setMessage('Note info saved!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      console.error('Failed to save note metadata:', err);
      setMessage('Failed to save note info');
    }
  };

  // AI Feature handlers
  const handleGenerateFlashcards = async (regenerate: boolean = false) => {
    if (!selectedNote) return;
    setGeneratingFlashcards(true);
    setMessage(regenerate ? 'Regenerating flashcards with AI...' : 'Loading flashcards...');
    try {
      const result = await notesAPI.generateFlashcards(selectedNote.id, regenerate);
      setFlashcards(result.cards);
      setFlashcardTitle(result.title);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
      setShowFlashcards(true);
      if (result.cached) {
        setMessage('');
      } else {
        setMessage('');
      }
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to generate flashcards'));
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleSummarize = async (regenerate: boolean = false) => {
    if (!selectedNote) return;
    setGeneratingSummary(true);
    setMessage(regenerate ? 'Regenerating summary with AI...' : 'Loading summary...');
    try {
      const result = await notesAPI.summarize(selectedNote.id, regenerate);
      setSummaryText(result.summary);
      setShowSummary(true);
      setMessage('');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to summarize'));
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Extract highlighted text (yellow background) from editor - returns array of individual highlights
  const getHighlightedTexts = (): string[] => {
    if (!editorRef.current) return [];
    
    const highlightedElements = editorRef.current.querySelectorAll('span[style*="background"]');
    const texts: string[] = [];
    
    highlightedElements.forEach((el) => {
      const style = (el as HTMLElement).style.backgroundColor;
      // Check for yellow-ish highlight colors
      if (style && style !== 'transparent' && style !== 'rgba(0, 0, 0, 0)') {
        const text = (el as HTMLElement).innerText.trim();
        if (text && !texts.includes(text)) texts.push(text);
      }
    });
    
    return texts;
  };

  // Open the highlight picker modal
  const handleExplainClick = async () => {
    const highlights = getHighlightedTexts();
    
    // Load cached explanations for this note
    let cached: {id: number; highlighted_text: string; explanation: string; created_at: string}[] = [];
    if (selectedNote?.id) {
      try {
        cached = await notesAPI.getExplanations(selectedNote.id);
        setCachedExplanations(cached);
      } catch {
        setCachedExplanations([]);
      }
    }
    
    // Combine current highlights with any cached explanations (for highlights that may have been removed)
    const cachedTexts = cached.map(c => c.highlighted_text);
    const allHighlights = [...new Set([...highlights, ...cachedTexts])];
    
    if (allHighlights.length === 0) {
      setMessage('Highlight some text first (use the 🖍️ highlight button), then click Explain.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    
    setCurrentHighlights(allHighlights);
    setShowHighlightPicker(true);
  };

  // Explain a specific highlight
  const handleExplainHighlight = async (text: string) => {
    setShowHighlightPicker(false);
    setGeneratingExplanation(true);
    setMessage('Getting AI explanation...');
    
    try {
      const result = await notesAPI.explain(text, selectedNote?.id);
      setExplanationText(result.explanation);
      setExplanationHighlight(result.highlighted_text);
      setShowExplanation(true);
      if (result.cached) {
        setMessage('📚 Loaded from cache!');
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage('');
        // Refresh cached explanations
        if (selectedNote?.id) {
          const newCached = await notesAPI.getExplanations(selectedNote.id);
          setCachedExplanations(newCached);
        }
      }
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to explain'));
    } finally {
      setGeneratingExplanation(false);
    }
  };

  // Legacy function for backward compatibility - now opens picker
  const handleExplain = handleExplainClick;

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
    // Ctrl+K - Insert Link
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      insertLink();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', background: darkMode ? '#1C1917' : '#f0f0f0' }}>
      {/* Title Bar */}
      <div style={{
        background: darkMode ? 'linear-gradient(135deg, #6C4B14 0%, #5A400F 100%)' : 'linear-gradient(180deg, #FFC107 0%, #FF9800 100%)',
        padding: '8px 15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: darkMode ? '#F5F0E8' : '#5D4037',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back
            </button>
          )}
          <span style={{ fontSize: '20px' }}>🐵🍌</span>
          <span style={{ fontWeight: 'bold', color: darkMode ? '#F5F0E8' : '#5D4037', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            NotePeel - {selectedNote?.title || 'Untitled'}
            {selectedNote && (
              <button
                onClick={() => { setEditTitle(selectedNote.title || ''); setShowRenameModal(true); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '12px',
                  color: darkMode ? '#A8A29E' : '#5D4037',
                  borderRadius: '3px',
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'none'; }}
                title="Rename note"
              >
                ✏️
              </button>
            )}
          </span>
        </div>
        <ProfileMenu
          userEmail={userEmail}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          darkMode={darkMode}
          showEmail={false}
        />
      </div>

      {/* Menu Bar */}
      <div style={{ background: theme.menuBg, borderBottom: `1px solid ${theme.border}`, display: 'flex', padding: '2px 10px', position: 'relative' }}>
        {/* File Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('file')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'file' ? null : current)}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'file' ? null : 'file'); }}
            style={getTopMenuButtonStyle('file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={(e) => { e.stopPropagation(); setActiveMenu(null); fileInputRef.current?.click(); }}>
                <span>📷 Upload New Note</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+U</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={newNote}>
                <span>📄 New Blank Note</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+N</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setShowNotesPanel(true); setActiveMenu(null); }}>
                <span>📁 Open Note...</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+O</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={saveNote}>
                <span>💾 Save</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+S</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={exportToPDF}>
                <span>📄 Export as PDF</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={exportToTXT}>
                <span>📝 Export as TXT</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={exportToHTML}>
                <span>🌐 Export as HTML</span>
              </div>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('edit')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'edit' ? null : current)}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'edit' ? null : 'edit'); }}
            style={getTopMenuButtonStyle('edit')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '200px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('undo'); setActiveMenu(null); }}>
                <span>↩️ Undo</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+Z</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('redo'); setActiveMenu(null); }}>
                <span>↪️ Redo</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+Y</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('selectAll'); setActiveMenu(null); }}>
                <span>🔲 Select All</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+A</span>
              </div>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('view')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'view' ? null : current)}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'view' ? null : 'view'); }}
            style={getTopMenuButtonStyle('view')}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setShowImage(!showImage); setActiveMenu(null); }}>
                <span>{showImage ? '✓ ' : ''}📷 Original Image</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setShowNotesPanel(!showNotesPanel); setActiveMenu(null); }}>
                <span>{showNotesPanel ? '✓ ' : ''}📁 Notes Panel</span>
              </div>
              <div style={{...menuItemStyle}} onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setShowNoteInfo(!showNoteInfo); setActiveMenu(null); }}>
                <span>{showNoteInfo ? '✓ ' : ''}🏷️ Note Info Panel</span>
              </div>
            </div>
          )}
        </div>

        {/* Insert Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('insert')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'insert' ? null : current)}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'insert' ? null : 'insert'); }}
            style={getTopMenuButtonStyle('insert')}
          >
            Insert
          </button>
          {activeMenu === 'insert' && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}
            >
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { insertPageBreak(); setActiveMenu(null); }}>
                <span>📃 Page Break</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+Enter</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('insertHorizontalRule'); setActiveMenu(null); }}>
                <span>➖ Horizontal Line</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { insertLink(); setActiveMenu(null); }}>
                <span>🔗 Link</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+K</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div
                style={{ position: 'relative' }}
                onMouseEnter={openTablePicker}
                onMouseLeave={closeTablePickerSoon}
              >
                <div
                  style={{ ...menuItemStyle, color: theme.text, background: showTablePicker ? theme.menuHover : 'transparent' }}
                >
                  <span>▦ Table</span>
                  <span style={{ color: theme.textSecondary, fontSize: '12px' }}>▶</span>
                </div>
                {showTablePicker && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={openTablePicker}
                    onMouseLeave={closeTablePickerSoon}
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: 'calc(100% - 8px)',
                      padding: '10px 12px 12px',
                      background: theme.menuBg,
                      border: `1px solid ${theme.border}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      width: 'max-content',
                      zIndex: 1001,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${TABLE_PICKER_MAX_COLS}, 18px)`,
                        gap: '3px',
                        width: 'fit-content',
                        marginBottom: '10px',
                      }}
                    >
                      {Array.from({ length: TABLE_PICKER_MAX_ROWS * TABLE_PICKER_MAX_COLS }, (_, index) => {
                        const row = Math.floor(index / TABLE_PICKER_MAX_COLS) + 1;
                        const col = (index % TABLE_PICKER_MAX_COLS) + 1;
                        const isActive = row <= tablePickerSize.rows && col <= tablePickerSize.cols;

                        return (
                          <button
                            key={`${row}-${col}`}
                            type="button"
                            onMouseEnter={() => setTablePickerSize({ rows: row, cols: col })}
                            onClick={(e) => {
                              e.stopPropagation();
                              insertTable(row, col);
                              setShowTablePicker(false);
                              setActiveMenu(null);
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              padding: 0,
                              borderRadius: '3px',
                              border: `1px solid ${isActive ? '#F57C00' : theme.border}`,
                              background: isActive ? (darkMode ? '#F57C00' : '#FFE0B2') : theme.menuBg,
                              cursor: 'pointer',
                              transition: 'background 0.12s ease, border-color 0.12s ease',
                            }}
                            aria-label={`Insert ${row} rows and ${col} columns`}
                          />
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary, minHeight: '18px' }}>
                      {tablePickerSize.rows && tablePickerSize.cols
                        ? `${tablePickerSize.rows} rows × ${tablePickerSize.cols} columns`
                        : 'Hover to choose table size'}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('insertUnorderedList'); setActiveMenu(null); }}>
                <span>• Bullet List</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+Shift+L</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('insertOrderedList'); setActiveMenu(null); }}>
                <span>1. Numbered List</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+Shift+N</span>
              </div>
            </div>
          )}
        </div>

        {/* Format Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('format')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'format' ? null : current)}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'format' ? null : 'format'); }}
            style={getTopMenuButtonStyle('format')}
          >
            Format
          </button>
          {activeMenu === 'format' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('bold'); setActiveMenu(null); }}>
                <span><b>B</b> Bold</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+B</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('italic'); setActiveMenu(null); }}>
                <span><i>I</i> Italic</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+I</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('underline'); setActiveMenu(null); }}>
                <span><u>U</u> Underline</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+U</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('strikeThrough'); setActiveMenu(null); }}>
                <span><s>S</s> Strikethrough</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('superscript'); setActiveMenu(null); }}>
                <span>X<sup>2</sup> Superscript</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('subscript'); setActiveMenu(null); }}>
                <span>X<sub>2</sub> Subscript</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { handleHighlight(); setActiveMenu(null); }}>
                <span style={{ background: highlightColor, padding: '0 4px' }}>H</span>
                <span> Highlight</span>
                <span style={{ color: theme.textSecondary, fontSize: '11px' }}>Ctrl+H</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{ padding: '4px 12px', fontSize: '11px', color: theme.textSecondary, fontWeight: 'bold', textTransform: 'uppercase' }}>Headings</div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('formatBlock', 'h1'); setActiveMenu(null); }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Heading 1</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('formatBlock', 'h2'); setActiveMenu(null); }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Heading 2</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('formatBlock', 'h3'); setActiveMenu(null); }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Heading 3</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('formatBlock', 'p'); setActiveMenu(null); }}>
                <span>Normal Text</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('justifyLeft'); setActiveMenu(null); }}>
                <span>⬅️ Align Left</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('justifyCenter'); setActiveMenu(null); }}>
                <span>↔️ Align Center</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { execCommand('justifyRight'); setActiveMenu(null); }}>
                <span>➡️ Align Right</span>
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text, fontWeight: lineSpacing === '1' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setLineSpacing('1'); setActiveMenu(null); }}>
                <span>{lineSpacing === '1' ? '✓ ' : ''}Single Spacing</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text, fontWeight: lineSpacing === '1.6' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setLineSpacing('1.6'); setActiveMenu(null); }}>
                <span>{lineSpacing === '1.6' ? '✓ ' : ''}1.5 Spacing</span>
              </div>
              <div style={{...menuItemStyle, color: theme.text, fontWeight: lineSpacing === '2' ? 'bold' : 'normal'}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { setLineSpacing('2'); setActiveMenu(null); }}>
                <span>{lineSpacing === '2' ? '✓ ' : ''}Double Spacing</span>
              </div>
            </div>
          )}
        </div>

        {/* AI Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => handleTopMenuHover('ai')}
            onMouseLeave={() => setHoveredTopMenu(current => current === 'ai' ? null : current)}
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'ai' ? null : 'ai'); }}
            style={getTopMenuButtonStyle('ai', { color: '#E65100', fontWeight: 'bold' })}
          >
            🧠 AI
          </button>
          {activeMenu === 'ai' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: theme.menuBg, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', zIndex: 1000 }}>
              <div style={{...menuItemStyle, color: selectedNote ? theme.text : theme.textSecondary}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { if (selectedNote) { handleGenerateFlashcards(); setActiveMenu(null); } }}>
                <span>🃏 Generate Flashcards</span>
                {generatingFlashcards && <span style={{ fontSize: '11px', color: theme.textSecondary }}>...</span>}
              </div>
              <div style={{...menuItemStyle, color: selectedNote ? theme.text : theme.textSecondary}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { if (selectedNote) { handleSummarize(); setActiveMenu(null); } }}>
                <span>📋 Summarize Note</span>
                {generatingSummary && <span style={{ fontSize: '11px', color: theme.textSecondary }}>...</span>}
              </div>
              <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />
              <div style={{...menuItemStyle, color: theme.text}} onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => { handleExplain(); setActiveMenu(null); }}>
                <span>💡 Explain Selection</span>
                {generatingExplanation && <span style={{ fontSize: '11px', color: theme.textSecondary }}>...</span>}
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
      <div style={{ background: theme.toolbarBg, borderBottom: `1px solid ${theme.border}`, padding: '8px 15px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Note Type Selector */}
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as 'default' | 'lecture' | 'meeting')}
          style={{ padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '13px', background: darkMode ? '#3C3836' : '#FFF8E1', color: theme.text }}
          title="Note type for Gemini AI"
        >
          <option value="default">📝 Default</option>
          <option value="lecture">📚 Lecture</option>
          <option value="meeting">📋 Meeting</option>
        </select>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Font Family */}
        <select
          value={fontFamily}
          onChange={(e) => { setFontFamily(e.target.value); execCommand('fontName', e.target.value); }}
          style={{ padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '13px', minWidth: '130px', background: theme.menuBg, color: theme.text }}
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
          style={{ padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '13px', width: '65px', background: theme.menuBg, color: theme.text }}
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
          style={{ padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '13px', width: '75px', background: theme.menuBg, color: theme.text }}
          title="Line Spacing"
        >
          <option value="1">1.0</option>
          <option value="1.6">1.5</option>
          <option value="2">2.0</option>
        </select>

        {/* Heading Selector */}
        <select
          onChange={(e) => { if (e.target.value) { execCommand('formatBlock', e.target.value); } e.target.value = ''; }}
          style={{ padding: '6px 10px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '13px', minWidth: '110px', background: theme.menuBg, color: theme.text }}
          title="Heading Level"
          defaultValue=""
        >
          <option value="" disabled>Heading</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="p">Normal</option>
        </select>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Text Formatting */}
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"><b>B</b></button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"><i>I</i></button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('strikeThrough')} title="Strikethrough"><s>S</s></button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`, fontSize: '12px'}} onClick={() => execCommand('superscript')} title="Superscript">X<sup style={{fontSize: '9px'}}>2</sup></button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`, fontSize: '12px'}} onClick={() => execCommand('subscript')} title="Subscript">X<sub style={{fontSize: '9px'}}>2</sub></button>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Text Color */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', marginRight: '4px', color: theme.text }}>A</span>
          <input
            type="color"
            onChange={(e) => execCommand('foreColor', e.target.value)}
            style={{ width: '28px', height: '28px', border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer', padding: '2px' }}
            title="Text Color"
          />
        </div>

        {/* Highlight Button + Color Picker */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={handleHighlight}
            style={{ ...toolbarBtnStyle, background: highlightColor, fontWeight: 'bold', minWidth: '28px', border: `1px solid ${theme.border}` }}
            title="Highlight (Ctrl+H)"
          >
            H
          </button>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            style={{ width: '20px', height: '28px', border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer', padding: '1px' }}
            title="Change Highlight Color"
          />
        </div>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Alignment */}
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('justifyLeft')} title="Align Left">⬅</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('justifyCenter')} title="Align Center">⬌</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('justifyRight')} title="Align Right">➡</button>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Lists */}
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('insertUnorderedList')} title="Bullet List (Ctrl+Shift+L)">•</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('insertOrderedList')} title="Numbered List (Ctrl+Shift+N)">1.</button>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Indent */}
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('outdent')} title="Decrease Indent (Shift+Tab)">⇤</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('indent')} title="Increase Indent (Tab)">⇥</button>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Undo/Redo */}
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)">↩</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)">↪</button>

        <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 4px' }} />

        {/* Zoom Controls */}
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ padding: '6px 8px', border: `1px solid ${theme.border}`, borderRadius: '4px', fontSize: '12px', background: theme.menuBg, color: theme.text, width: '70px' }} title="Zoom">
          <option value={50}>50%</option>
          <option value={75}>75%</option>
          <option value={100}>100%</option>
          <option value={125}>125%</option>
          <option value={150}>150%</option>
        </select>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => setZoom(Math.max(50, zoom - 25))} title="Zoom Out">−</button>
        <button style={{...toolbarBtnStyle, background: theme.menuBg, color: theme.text, border: `1px solid ${theme.border}`}} onClick={() => setZoom(Math.min(150, zoom + 25))} title="Zoom In">+</button>

        <div style={{ flex: 1 }} />

        {/* Save Button */}
        <button
          onClick={saveNote}
          disabled={!selectedNote}
          style={{
            padding: '6px 16px',
            background: selectedNote ? (notebookColor ?? 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)') : '#ccc',
            color: selectedNote ? (notebookColor ? '#ffffff' : '#5D4037') : '#888',
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
          background: message.includes('Error') ? '#ffebee' : (darkMode ? '#3C3836' : '#FFF8E1'),
          color: message.includes('Error') ? '#c62828' : theme.text,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <span>{uploading ? '🍌 Peeling...' : message}</span>
          <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text }}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Notes Panel (toggleable) */}
        {showNotesPanel && (
          <div style={{ width: '250px', background: theme.cardBg, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: `1px solid ${theme.border}`, fontWeight: 'bold', color: theme.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📁 Your Notes ({notes.length})</span>
              <button onClick={() => setShowNotesPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: theme.text }}>✕</button>
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
                <p style={{ color: theme.textSecondary, fontSize: '13px', padding: '10px' }}>Loading...</p>
              ) : notes.length === 0 ? (
                <p style={{ color: theme.textSecondary, fontSize: '13px', padding: '10px' }}>No notes yet. Upload one!</p>
              ) : (
                filteredNotes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => viewNote(note)}
                    style={{
                      padding: '10px',
                      marginBottom: '6px',
                      background: selectedNote?.id === note.id ? (darkMode ? '#3C3836' : '#FFF8E1') : (darkMode ? '#292524' : '#f9f9f9'),
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: selectedNote?.id === note.id ? '1px solid #FFB74D' : `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {note.title || 'Untitled'}
                          {note.status === 'failed' && (
                            <span title="Text extraction failed" style={{
                              fontSize: '9px',
                              background: darkMode ? 'rgba(211, 47, 47, 0.2)' : '#FFEBEE',
                              color: darkMode ? '#ef9a9a' : '#C62828',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              border: `1px solid ${darkMode ? 'rgba(211, 47, 47, 0.3)' : '#FFCDD2'}`,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}>
                              ⚠ Failed
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: theme.textSecondary, marginTop: '2px' }}>
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
          <div style={{ width: '350px', background: darkMode ? '#292524' : '#f5f5f5', borderRight: `1px solid ${theme.border}`, padding: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: theme.text }}>📷 Original Image</h3>
              <button onClick={() => setShowImage(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: theme.text }}>✕</button>
            </div>
            {selectedNote.image_url && (
              <img
                src={selectedNote.image_url}
                alt="Note"
                style={{ maxWidth: '100%', borderRadius: '8px', border: `1px solid ${theme.border}` }}
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
              <div style={{ marginBottom: '4px' }}><strong>Status:</strong> <span style={{ color: selectedNote.status === 'failed' ? '#C62828' : selectedNote.status === 'completed' ? '#2E7D32' : '#F57F17' }}>{selectedNote.status === 'failed' ? '⚠ Failed' : selectedNote.status === 'completed' ? 'Completed' : selectedNote.status}</span></div>
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
        <div style={{ flex: 1, background: darkMode ? '#1C1917' : '#e0e0e0', padding: '30px', overflowY: 'auto' }}>
          <div style={{
            maxWidth: '850px',
            margin: '0 auto',
            background: darkMode ? '#292524' : 'white',
            boxShadow: darkMode ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.1)',
            minHeight: '1100px',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}>
            {/* Notebook color header */}
            {notebookColor && selectedNote && (
              <>
                <div style={{
                  background: notebookColor,
                  padding: '48px 80px 36px',
                  borderRadius: '0',
                }}>
                  <div style={{
                    fontSize: '11px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    color: getNotebookContrastColor(notebookColor),
                    opacity: 0.6,
                    marginBottom: '12px',
                    fontWeight: 500,
                  }}>
                    Note
                  </div>
                  <h1 style={{
                    margin: 0,
                    fontSize: '34px',
                    fontWeight: 700,
                    color: getNotebookContrastColor(notebookColor),
                    lineHeight: 1.2,
                    letterSpacing: '-0.5px',
                  }}>
                    {selectedNote.title || 'Untitled'}
                  </h1>
                </div>
                <div style={{
                  height: '48px',
                  background: `linear-gradient(to bottom, ${notebookColor}, ${darkMode ? '#292524' : 'white'})`,
                }} />
              </>
            )}

            {/* Failed note banner */}
            {selectedNote?.status === 'failed' && !dismissedFailedBanner && !selectedNote?.structured_text && !selectedNote?.raw_text && (
              <div style={{
                margin: '20px 40px 0',
                padding: '16px 20px',
                background: darkMode ? 'rgba(211, 47, 47, 0.12)' : '#FFF3F0',
                border: `1px solid ${darkMode ? 'rgba(211, 47, 47, 0.3)' : '#FFCDD2'}`,
                borderRadius: '10px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '24px', lineHeight: '1' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: darkMode ? '#ef9a9a' : '#C62828', marginBottom: '4px' }}>
                    Text extraction failed
                  </div>
                  <div style={{ fontSize: '13px', color: darkMode ? '#bbb' : '#555', lineHeight: '1.5' }}>
                    {selectedNote.error_message || 'We couldn\'t extract text from this image.'}
                  </div>
                  <div style={{ fontSize: '12px', color: darkMode ? '#999' : '#888', marginTop: '6px' }}>
                    Tip: Try uploading a clearer photo of handwritten notes. You can also type your notes directly below.
                  </div>
                </div>
                <button
                  onClick={() => setDismissedFailedBanner(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: darkMode ? '#999' : '#aaa', lineHeight: 1, padding: '0' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Paper - auto-expanding */}
            <div
              ref={editorRef}
              contentEditable
            style={{
              padding: `${notebookColor && selectedNote ? '20px' : '60px'} 80px 60px`,
              minHeight: '1000px',
                fontSize: '16px',
                fontFamily: fontFamily,
                lineHeight: lineSpacing,
                outline: 'none',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal',
                color: theme.text,
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onFocus={saveSelection}
            onInput={updateCounts}
            suppressContentEditableWarning
          />
          </div>
        </div>
      </div>

      {/* ── Flashcard Modal ── */}
      {showFlashcards && flashcards.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowFlashcards(false)}>
          <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: theme.text, fontSize: '18px' }}>🃏 {flashcardTitle}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => { setShowFlashcards(false); handleGenerateFlashcards(true); }} 
                  style={{ background: darkMode ? '#3C3836' : '#FFF3E0', border: '1px solid #FFB74D', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#E65100' }}
                  title="Generate new flashcards"
                >
                  🔄 Regenerate
                </button>
                <button onClick={() => setShowFlashcards(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text }}>✕</button>
              </div>
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
                style={{ padding: '8px 20px', border: `1px solid ${theme.border}`, borderRadius: '8px', background: flashcardIndex === 0 ? theme.menuHover : theme.menuBg, cursor: flashcardIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '14px', color: theme.text }}
              >
                Previous
              </button>
              <span style={{ color: theme.textSecondary, fontSize: '13px' }}>{flashcardIndex + 1} / {flashcards.length}</span>
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
          <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '30px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2E7D32', fontSize: '18px' }}>📋 AI Summary</h2>
              <button onClick={() => setShowSummary(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text }}>✕</button>
            </div>
            <div style={{ background: darkMode ? '#1e3a2f' : '#E8F5E9', borderRadius: '12px', padding: '24px', lineHeight: '1.8', color: theme.text, fontSize: '15px', whiteSpace: 'pre-wrap' }}>
              {summaryText}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summaryText);
                  setMessage('Summary copied to clipboard!');
                  setTimeout(() => setMessage(''), 2000);
                }}
                style={{ padding: '8px 20px', background: darkMode ? '#1e3a2f' : '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#2E7D32' }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Highlight Picker Modal ── */}
      {showHighlightPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowHighlightPicker(false)}>
          <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#E65100', fontSize: '18px' }}>💡 Select Highlight to Explain</h2>
              <button onClick={() => setShowHighlightPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text }}>✕</button>
            </div>
            <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '16px' }}>
              Click on a highlighted section to get an AI explanation:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentHighlights.map((text, idx) => {
                const cached = cachedExplanations.find(c => c.highlighted_text === text);
                return (
                  <div
                    key={idx}
                    onClick={() => handleExplainHighlight(text)}
                    style={{
                      background: '#FFEB3B',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ color: '#5D4037', fontSize: '14px', flex: 1, marginRight: '12px' }}>
                      "{text.length > 80 ? text.slice(0, 80) + '...' : text}"
                    </span>
                    {cached ? (
                      <span style={{ background: '#4CAF50', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        📚 Cached
                      </span>
                    ) : (
                      <span style={{ background: '#FF9800', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        ✨ New
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {currentHighlights.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: theme.textSecondary }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🖍️</div>
                <p>No highlights found. Use the highlight tool to select text first!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Explanation Modal ── */}
      {showExplanation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowExplanation(false)}>
          <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '30px', maxWidth: '550px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#E65100', fontSize: '18px' }}>💡 AI Explanation</h2>
              <button onClick={() => setShowExplanation(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text }}>✕</button>
            </div>
            {explanationHighlight && (
              <div style={{ background: '#FFEB3B', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#5D4037', fontStyle: 'italic' }}>
                <strong>Explaining:</strong> "{explanationHighlight.length > 100 ? explanationHighlight.slice(0, 100) + '...' : explanationHighlight}"
              </div>
            )}
            <div style={{ background: darkMode ? '#3a3a2e' : '#FFF3E0', borderRadius: '12px', padding: '24px', lineHeight: '1.8', color: theme.text, fontSize: '15px', whiteSpace: 'pre-wrap' }}>
              {explanationText}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && selectedNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowRenameModal(false)}>
          <div style={{ background: theme.cardBg, borderRadius: '12px', padding: '24px', width: '400px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: theme.text, fontSize: '16px' }}>📝 Rename Note</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { saveTitle(); setShowRenameModal(false); } if (e.key === 'Escape') setShowRenameModal(false); }}
              placeholder="Enter note title..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                outline: 'none',
                background: theme.inputBg,
                color: theme.text,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setShowRenameModal(false)}
                style={{ padding: '8px 16px', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '6px', cursor: 'pointer', color: theme.text }}
              >
                Cancel
              </button>
              <button
                onClick={() => { saveTitle(); setShowRenameModal(false); }}
                style={{ padding: '8px 16px', border: 'none', background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)', borderRadius: '6px', cursor: 'pointer', color: '#5D4037', fontWeight: 'bold' }}
              >
                Save
              </button>
            </div>
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

      {/* Status Bar */}
      <div style={{
        background: theme.statusBar,
        borderTop: `1px solid ${theme.border}`,
        padding: '4px 15px',
        fontSize: '12px',
        color: theme.textSecondary,
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>{selectedNote ? `Editing: ${selectedNote.title || 'Untitled'}` : 'No note selected - Use File → Upload New Note to get started'}</span>
        <span>{charCount} characters • {wordCount} words • {zoom}% | Gemini AI 🐵🍌</span>
      </div>
    </div>
  );
}
