import { useState, useEffect, useRef, useCallback } from 'react';
import { notesAPI } from '../services/api';
import type { Note, NoteWithImage, Categories } from '../types';
import { UsageBanner } from '../components/UsageBanner';
import { FeatureGate } from '../components/FeatureGate';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
  initialNoteId?: number;
  notebookId?: number;
  onBack?: () => void;
  darkMode?: boolean;
}

export default function Dashboard({ userEmail, onLogout, initialNoteId, notebookId: _notebookId, onBack, darkMode = false }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteWithImage | null>(null);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [fontSize, setFontSize] = useState('4');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [lineSpacing, setLineSpacing] = useState('1');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [noteType, setNoteType] = useState<'default' | 'lecture' | 'meeting'>('default');
  const [zoom, setZoom] = useState(100);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout' | 'design' | 'view' | 'ai'>('home');
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [pageMargin, setPageMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [columnCount, setColumnCount] = useState(1);
  const [pageBorderEnabled, setPageBorderEnabled] = useState(false);
  const [pageColor, setPageColor] = useState('');
  const [watermarkText, setWatermarkText] = useState('');

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  const [showTableGrid, setShowTableGrid] = useState(false);
  const [tableHoverRow, setTableHoverRow] = useState(0);
  const [tableHoverCol, setTableHoverCol] = useState(0);

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

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [currentHighlights, setCurrentHighlights] = useState<string[]>([]);
  const [cachedExplanations, setCachedExplanations] = useState<{id: number; highlighted_text: string; explanation: string; created_at: string}[]>([]);
  const [_categories, setCategories] = useState<Categories>({ subjects: [], topics: [], tags: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [_isSearching, setIsSearching] = useState(false);
  const [showNoteInfo, setShowNoteInfo] = useState(false);
  const [_editSubject, setEditSubject] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [showPeelingModal, setShowPeelingModal] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const margins = { normal: '72px 80px', narrow: '36px 48px', wide: '72px 120px' };
  const PAGE_HEIGHT = 1056;

  const t = {
    titleBar: darkMode ? '#1e1e2f' : '#5D4037',
    ribbonBg: darkMode ? '#252542' : '#f3f3f3',
    ribbonBorder: darkMode ? '#3f3f5a' : '#d1d1d1',
    ribbonGroupLabel: darkMode ? '#888' : '#888',
    tabActive: darkMode ? '#252542' : '#f3f3f3',
    tabText: darkMode ? '#ccc' : '#5D4037',
    tabActiveText: darkMode ? '#fff' : '#333',
    bg: darkMode ? '#1a1a2e' : '#e8e8e8',
    cardBg: darkMode ? '#252542' : '#ffffff',
    text: darkMode ? '#e4e4e7' : '#333333',
    textSecondary: darkMode ? '#a1a1aa' : '#666666',
    border: darkMode ? '#3f3f5a' : '#d1d1d1',
    menuBg: darkMode ? '#252542' : '#ffffff',
    menuHover: darkMode ? '#3f3f5a' : '#e8e8e8',
    editorBg: darkMode ? '#252542' : '#ffffff',
    statusBar: darkMode ? '#1e1e2f' : '#5D4037',
    inputBg: darkMode ? '#1a1a2e' : '#ffffff',
    accent: '#E65100',
    accentLight: darkMode ? '#3a2a1a' : '#FFF3E0',
    brand: '#FF9800',
    // Dark mode adaptive colors for shapes
    shapeBg: darkMode ? '#3f3f5a' : '#e3f2fd',
    shapeBorder: darkMode ? '#7a7aaa' : '#1976d2',
    shapeBg2: darkMode ? '#2d3a2f' : '#e8f5e9',
    shapeBorder2: darkMode ? '#6aaa77' : '#43a047',
    shapeBg3: darkMode ? '#3a2a3a' : '#fce4ec',
    shapeBorder3: darkMode ? '#aa77aa' : '#e91e63',
    shapeBg4: darkMode ? '#3a3a1a' : '#fffde7',
    shapeBorder4: darkMode ? '#aaaa66' : '#fbc02d',
    tableBorder: darkMode ? '#666' : '#bbb',
    highlightBg: darkMode ? '#8B8000' : '#FFFF00',
  };

  const fmtBtnStyle: React.CSSProperties = {
    padding: '3px 7px', background: 'transparent', border: '1px solid transparent',
    borderRadius: '2px', cursor: 'pointer', fontSize: '13px', color: t.text,
    minWidth: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  // ═══ LIFECYCLE ═══
  useEffect(() => { loadNotes(); }, []);
  useEffect(() => { if (initialNoteId && !loading) loadInitialNote(); }, [initialNoteId, loading]);
  useEffect(() => { const h = () => { setActiveMenu(null); setShowTableGrid(false); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

  const prepareContentForEditor = (html: string): string => {
    if (!darkMode) return html;
    return html.replace(/color:\s*#3E2723/gi, 'color: inherit').replace(/color:\s*#5D4037/gi, 'color: inherit').replace(/color:\s*#333333/gi, 'color: inherit').replace(/color:\s*#333/gi, 'color: inherit').replace(/color:\s*rgb\(62,\s*39,\s*35\)/gi, 'color: inherit').replace(/color:\s*rgb\(93,\s*64,\s*55\)/gi, 'color: inherit');
  };

  const updateCounts = useCallback(() => {
    if (editorRef.current) {
      const txt = editorRef.current.innerText || '';
      setCharCount(txt.length);
      setWordCount(txt.split(/\s+/).filter(w => w.length > 0).length);
      setPageCount(Math.max(1, Math.ceil(editorRef.current.scrollHeight / PAGE_HEIGHT)));
    }
  }, []);

  const handleEditorScroll = useCallback(() => {
    if (editorScrollRef.current) {
      const st = editorScrollRef.current.scrollTop;
      const eph = (PAGE_HEIGHT + 32) * (zoom / 100);
      setCurrentPage(Math.min(pageCount, Math.max(1, Math.floor(st / eph) + 1)));
    }
  }, [zoom, pageCount]);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredNotes(notes); setIsSearching(false); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try { const r = await notesAPI.search(searchQuery); setFilteredNotes(r); }
      catch { setFilteredNotes(notes.filter(n => (n.title||'').toLowerCase().includes(searchQuery.toLowerCase()))); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, notes]);

  const loadNotes = async () => {
    try { const data = await notesAPI.getAll(); setNotes(data); setFilteredNotes(data); try { const cats = await notesAPI.getCategories(); setCategories(cats); } catch {} }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const loadInitialNote = async () => {
    if (!initialNoteId) return;
    try { const fn = await notesAPI.getById(initialNoteId); setSelectedNote(fn); if (editorRef.current) { const c = fn.structured_text || fn.raw_text || ''; editorRef.current.innerHTML = prepareContentForEditor(c.includes('<') && c.includes('>') ? c : c.replace(/\n/g, '<br>')); updateCounts(); } }
    catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setUploading(true); setShowPeelingModal(true); setActiveMenu(null);
    try {
      let nn: Note;
      if (files.length === 1) {
        nn = await notesAPI.upload(files[0], noteType);
      } else {
        nn = await notesAPI.uploadMulti(Array.from(files), noteType);
      }
      setNotes([nn, ...notes]); await viewNote(nn); setMessage('🐵 Note peeled!'); setTimeout(() => setMessage(''), 3000);
    }
    catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed')); }
    finally { setUploading(false); setShowPeelingModal(false); e.target.value = ''; }
  };

  const viewNote = async (note: Note) => {
    await autoSave();
    try { const fn = await notesAPI.getById(note.id); setSelectedNote(fn); if (editorRef.current) { const c = fn.structured_text || fn.raw_text || ''; editorRef.current.innerHTML = prepareContentForEditor(c.includes('<') && c.includes('>') ? c : c.replace(/\n/g, '<br>')); updateCounts(); } setShowImage(false); setShowNotesPanel(false); setActiveMenu(null); setEditSubject(fn.subject||''); setEditTopic(fn.topic||''); setEditTags(fn.tags||''); setEditTitle(fn.title||''); }
    catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); }
  };

  const saveNote = async () => {
    if (!selectedNote || !editorRef.current) return;
    try { const txt = editorRef.current.innerHTML; await notesAPI.update(selectedNote.id, { structured_text: txt }); setSelectedNote({ ...selectedNote, structured_text: txt }); setMessage('💾 Saved!'); setTimeout(() => setMessage(''), 3000); }
    catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); }
  };

  const autoSave = async () => {
    if (!selectedNote || !editorRef.current) return;
    try { const txt = editorRef.current.innerHTML; if (txt !== selectedNote.structured_text) { await notesAPI.update(selectedNote.id, { structured_text: txt }); setSelectedNote(p => p ? { ...p, structured_text: txt } : null); } } catch {}
  };

  const _deleteNote = async (noteId: number) => {
    if (!window.confirm('Delete this note?')) return;
    try { await notesAPI.delete(noteId); setNotes(notes.filter(n => n.id !== noteId)); if (selectedNote?.id === noteId) { setSelectedNote(null); if (editorRef.current) editorRef.current.innerHTML = ''; } setMessage('Deleted'); setTimeout(() => setMessage(''), 3000); }
    catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); }
  };

  const newNote = async () => { await autoSave(); setSelectedNote(null); if (editorRef.current) editorRef.current.innerHTML = ''; setActiveMenu(null); updateCounts(); };
  const execCommand = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };

  // ─── Title ───
  const startEditTitle = () => { setTitleDraft(selectedNote?.title || 'Untitled'); setIsEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 50); };
  const commitTitle = async () => {
    setIsEditingTitle(false); const nt = titleDraft.trim() || 'Untitled'; if (!selectedNote) return;
    try { await notesAPI.update(selectedNote.id, { title: nt }); setSelectedNote({ ...selectedNote, title: nt }); setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title: nt } : n)); } catch {}
  };

  // ─── Insert Table (FIX: use focus + range approach) ───
  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    let html = '<table style="border-collapse:collapse;width:100%;margin:12px 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += `<td style="border:1px solid ${t.tableBorder};padding:8px 12px;min-width:40px;vertical-align:top;">\u00a0</td>`;
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      range.insertNode(frag);
      range.collapse(false);
    } else {
      editorRef.current.innerHTML += html;
    }
    setShowTableGrid(false);
    updateCounts();
  };

  // ─── Insert Picture ───
  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !editorRef.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editorRef.current?.focus();
      const imgHtml = `<img src="${dataUrl}" style="max-width:100%;height:auto;margin:12px 0;border-radius:4px;display:block;" />`;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const tmp = document.createElement('div'); tmp.innerHTML = imgHtml + '<p><br></p>';
        const frag = document.createDocumentFragment();
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        range.insertNode(frag);
        range.collapse(false);
      } else {
        editorRef.current!.innerHTML += imgHtml + '<p><br></p>';
      }
      updateCounts();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Insert elements ───
  const insertTextBox = () => {
    if (!editorRef.current) return;
    document.execCommand('insertHTML', false, `<div class="np-shape np-shape-1" data-np-shape="true" data-np-placeholder="true" style="border:2px solid;padding:16px;margin:12px 0;border-radius:4px;min-height:60px;width:300px;position:relative;color:${t.textSecondary};" contenteditable="true">Type here...</div><p><br></p>`);
    editorRef.current.focus();
  };

  const insertShape = (type: string) => {
    const shapes: Record<string, string> = {
      rect: `<div class="np-shape np-shape-1" data-np-shape="true" data-np-placeholder="true" style="width:200px;height:100px;border:2px solid;border-radius:4px;margin:12px 0;display:flex;align-items:center;justify-content:center;position:relative;color:${t.textSecondary};" contenteditable="true">Text</div>`,
      rounded: `<div class="np-shape np-shape-2" data-np-shape="true" data-np-placeholder="true" style="width:200px;height:100px;border:2px solid;border-radius:20px;margin:12px 0;display:flex;align-items:center;justify-content:center;position:relative;color:${t.textSecondary};" contenteditable="true">Text</div>`,
      circle: `<div class="np-shape np-shape-3" data-np-shape="true" data-np-placeholder="true" style="width:120px;height:120px;border:2px solid;border-radius:50%;margin:12px 0;display:flex;align-items:center;justify-content:center;position:relative;color:${t.textSecondary};" contenteditable="true">Text</div>`,
      callout: `<div class="np-shape np-shape-4" data-np-shape="true" data-np-placeholder="true" style="width:250px;border:2px solid;border-radius:8px;padding:16px;margin:12px 0;position:relative;color:${t.textSecondary};" contenteditable="true">Callout text here</div>`,
    };
    if (!editorRef.current || !shapes[type]) return;
    document.execCommand('insertHTML', false, shapes[type] + '<p><br></p>');
    editorRef.current.focus();
  };

  // Clear placeholder text on first focus/click into a shape
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset?.npPlaceholder === 'true') {
        target.innerHTML = '';
        target.style.color = '';
        delete target.dataset.npPlaceholder;
      }
    };
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('focusin', handleFocusIn);
      return () => editor.removeEventListener('focusin', handleFocusIn);
    }
  });

  // ─── Shape selection & manipulation ───
  const [selectedShape, setSelectedShape] = useState<HTMLElement | null>(null);
  const [shapeHandleAction, setShapeHandleAction] = useState<string | null>(null);
  const [shapeStartPos, setShapeStartPos] = useState<{x:number,y:number,w:number,h:number,mx:number,my:number,rot:number,cx:number,cy:number}>({x:0,y:0,w:0,h:0,mx:0,my:0,rot:0,cx:0,cy:0});

  // Click handler to detect shape selection
  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const shape = target.closest?.('[data-np-shape]') as HTMLElement | null;
      if (shape && editorRef.current?.contains(shape)) {
        setSelectedShape(shape);
      } else if (!target.closest?.('.np-shape-handles')) {
        setSelectedShape(null);
      }
    };
    document.addEventListener('mousedown', handleEditorClick);
    return () => document.removeEventListener('mousedown', handleEditorClick);
  }, []);

  // Shape manipulation handlers
  const handleShapeMouseDown = (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedShape) return;
    const rect = selectedShape.getBoundingClientRect();
    const currentRotation = parseFloat(selectedShape.dataset.npRotation || '0');
    setShapeHandleAction(action);
    setShapeStartPos({
      x: rect.left, y: rect.top,
      w: selectedShape.offsetWidth, h: selectedShape.offsetHeight,
      mx: e.clientX, my: e.clientY,
      rot: currentRotation,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    });
  };

  useEffect(() => {
    if (!shapeHandleAction || !selectedShape) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - shapeStartPos.mx;
      const dy = e.clientY - shapeStartPos.my;
      const zf = zoom / 100;

      if (shapeHandleAction === 'move') {
        const ml = parseFloat(selectedShape.style.marginLeft || '0') + dx / zf;
        const mt = parseFloat(selectedShape.style.marginTop || '12') + dy / zf;
        selectedShape.style.marginLeft = `${ml}px`;
        selectedShape.style.marginTop = `${mt}px`;
        setShapeStartPos(p => ({...p, mx: e.clientX, my: e.clientY}));
      } else if (shapeHandleAction === 'rotate') {
        // Calculate angle from center of shape to mouse
        const angle = Math.atan2(e.clientY - shapeStartPos.cy, e.clientX - shapeStartPos.cx);
        const startAngle = Math.atan2(shapeStartPos.my - shapeStartPos.cy, shapeStartPos.mx - shapeStartPos.cx);
        let deg = shapeStartPos.rot + ((angle - startAngle) * 180 / Math.PI);
        // Snap to 15° increments when holding shift
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        selectedShape.style.transform = `rotate(${deg}deg)`;
        selectedShape.dataset.npRotation = String(deg);
      } else {
        let newW = shapeStartPos.w;
        let newH = shapeStartPos.h;
        if (shapeHandleAction.includes('e')) newW = Math.max(40, shapeStartPos.w + dx / zf);
        if (shapeHandleAction.includes('w')) newW = Math.max(40, shapeStartPos.w - dx / zf);
        if (shapeHandleAction.includes('s')) newH = Math.max(30, shapeStartPos.h + dy / zf);
        if (shapeHandleAction.includes('n')) newH = Math.max(30, shapeStartPos.h - dy / zf);
        selectedShape.style.width = `${newW}px`;
        selectedShape.style.height = `${newH}px`;
      }
    };
    const handleMouseUp = () => setShapeHandleAction(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [shapeHandleAction, selectedShape, shapeStartPos, zoom]);

  // Force re-render when scrolling so handles track the shape
  const [, forceUpdate] = useState(0);
  const _origHandleEditorScroll = handleEditorScroll;
  // We'll trigger re-render on scroll in a separate effect
  useEffect(() => {
    if (!selectedShape || !editorScrollRef.current) return;
    const el = editorScrollRef.current;
    const onScroll = () => forceUpdate(n => n + 1);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [selectedShape]);

  // Compute handle positions — use viewport coords relative to scroll container
  const getShapeHandles = () => {
    if (!selectedShape || !editorScrollRef.current) return null;
    const scrollEl = editorScrollRef.current;
    const scrollRect = scrollEl.getBoundingClientRect();
    const shapeRect = selectedShape.getBoundingClientRect();

    // Position relative to the scroll container's visible area
    const top = shapeRect.top - scrollRect.top;
    const left = shapeRect.left - scrollRect.left;
    const w = shapeRect.width;
    const h = shapeRect.height;
    const hs = 10; // handle size
    const ho = hs / 2;

    const handles = [
      { cursor: 'nw-resize', action: 'nw', x: left - ho, y: top - ho },
      { cursor: 'n-resize',  action: 'n',  x: left + w/2 - ho, y: top - ho },
      { cursor: 'ne-resize', action: 'ne', x: left + w - ho, y: top - ho },
      { cursor: 'w-resize',  action: 'w',  x: left - ho, y: top + h/2 - ho },
      { cursor: 'e-resize',  action: 'e',  x: left + w - ho, y: top + h/2 - ho },
      { cursor: 'sw-resize', action: 'sw', x: left - ho, y: top + h - ho },
      { cursor: 's-resize',  action: 's',  x: left + w/2 - ho, y: top + h - ho },
      { cursor: 'se-resize', action: 'se', x: left + w - ho, y: top + h - ho },
    ];

    return { handles, top, left, w, h, hs };
  };

  const insertDateTime = () => { document.execCommand('insertText', false, new Date().toLocaleString()); editorRef.current?.focus(); };
  const insertSymbol = (s: string) => { document.execCommand('insertText', false, s); editorRef.current?.focus(); };

  // ─── Header with delete button ───
  const insertHeader = () => {
    if (!editorRef.current) return;
    const title = selectedNote?.title || 'Untitled';
    const hdr = `<div class="np-header" style="border-bottom:2px solid ${darkMode?'#555':'#ddd'};padding-bottom:8px;margin-bottom:16px;font-size:10px;color:${t.textSecondary};display:flex;justify-content:space-between;position:relative;"><span>${title}</span><span>${new Date().toLocaleDateString()}</span><button onclick="this.parentElement.remove()" style="position:absolute;right:-20px;top:-4px;background:${t.accent};color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:16px;text-align:center;" title="Delete header">✕</button></div>`;
    editorRef.current.innerHTML = hdr + editorRef.current.innerHTML;
    editorRef.current.focus();
  };

  const insertFooter = () => {
    if (!editorRef.current) return;
    const ftr = `<div class="np-footer" style="border-top:2px solid ${darkMode?'#555':'#ddd'};padding-top:8px;margin-top:16px;font-size:10px;color:${t.textSecondary};display:flex;justify-content:space-between;position:relative;"><span>${userEmail}</span><span>Page 1</span><button onclick="this.parentElement.remove()" style="position:absolute;right:-20px;top:-4px;background:${t.accent};color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:16px;text-align:center;" title="Delete footer">✕</button></div>`;
    editorRef.current.innerHTML += ftr;
    editorRef.current.focus();
  };

  // ─── New Page ───
  const insertNewPage = () => {
    if (!editorRef.current) return;
    // Insert a page-break spacer that fills to the next page boundary
    const spacerHtml = `<div contenteditable="false" class="np-page-break" style="height:${PAGE_HEIGHT}px;pointer-events:none;user-select:none;border-top:1px dashed ${t.border};margin-top:20px;position:relative;"><span style="position:absolute;top:4px;left:50%;transform:translateX(-50%);font-size:9px;color:${t.textSecondary};background:${t.editorBg};padding:0 8px;">New Page</span></div><p><br></p>`;
    // Append at end
    editorRef.current.innerHTML += spacerHtml;
    // Scroll to bottom
    if (editorScrollRef.current) editorScrollRef.current.scrollTop = editorScrollRef.current.scrollHeight;
    updateCounts();
    editorRef.current.focus();
  };

  // ─── Find & Replace ───
  const handleFind = () => {
    if (!findText || !editorRef.current) return;
    const cleaned = editorRef.current.innerHTML.replace(/<mark class="np-find"[^>]*>(.*?)<\/mark>/gi, '$1');
    const regex = new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    editorRef.current.innerHTML = cleaned.replace(regex, '<mark class="np-find" style="background:#FF9800;color:#fff;padding:0 2px;border-radius:2px;">$1</mark>');
  };
  const handleReplace = () => {
    if (!findText || !editorRef.current) return;
    const cleaned = editorRef.current.innerHTML.replace(/<mark class="np-find"[^>]*>(.*?)<\/mark>/gi, '$1');
    editorRef.current.innerHTML = cleaned.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText);
    updateCounts(); setMessage('Replaced all'); setTimeout(() => setMessage(''), 2000);
  };
  const clearFindHighlights = () => { if (editorRef.current) editorRef.current.innerHTML = editorRef.current.innerHTML.replace(/<mark class="np-find"[^>]*>(.*?)<\/mark>/gi, '$1'); };

  // ─── Page Break ───
  const insertPageBreak = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection(); if (!sel || sel.rangeCount === 0) { editorRef.current.focus(); return; }
    const range = sel.getRangeAt(0); const rect = range.getBoundingClientRect(); const eRect = editorRef.current.getBoundingClientRect();
    const cy = rect.top - eRect.top + editorRef.current.scrollTop;
    const rem = PAGE_HEIGHT - (((cy % PAGE_HEIGHT) + PAGE_HEIGHT) % PAGE_HEIGHT);
    document.execCommand('insertHTML', false, `<div contenteditable="false" style="height:${Math.max(50,rem)}px;pointer-events:none;user-select:none;page-break-after:always;">&shy;</div><p><br></p>`);
    editorRef.current.focus(); updateCounts();
  };

  // ─── Exports ───
  const exportToPDF = () => { if (!editorRef.current) return; const pw = window.open('','_blank'); if (!pw){setMessage('Allow popups');return;} const tmp=document.createElement('div');tmp.innerHTML=editorRef.current.innerHTML;tmp.querySelectorAll('div[contenteditable="false"]').forEach(el=>{const pb=document.createElement('div');pb.style.pageBreakAfter='always';pb.style.height='0';el.replaceWith(pb);}); pw.document.write(`<!DOCTYPE html><html><head><title>${selectedNote?.title||'Note'}</title><style>@page{size:letter;margin:72px 80px}body{font-family:${fontFamily},serif;margin:0;line-height:${lineSpacing};color:#333;font-size:16px}</style></head><body>${tmp.innerHTML}</body></html>`); pw.document.close();pw.print();setActiveMenu(null); };
  const exportToTXT = () => { if(!editorRef.current)return; const b=new Blob([editorRef.current.innerText],{type:'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${selectedNote?.title||'note'}.txt`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);setMessage('Exported!');setTimeout(()=>setMessage(''),3000);setActiveMenu(null); };
  const exportToHTML = () => { if(!editorRef.current)return; const b=new Blob([`<!DOCTYPE html><html><head><title>${selectedNote?.title||'Note'}</title><style>body{font-family:${fontFamily},serif;max-width:800px;margin:40px auto;padding:20px;line-height:${lineSpacing}}</style></head><body><h1>${selectedNote?.title||'Untitled'}</h1>${editorRef.current.innerHTML}</body></html>`],{type:'text/html'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${selectedNote?.title||'note'}.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);setMessage('Exported!');setTimeout(()=>setMessage(''),3000);setActiveMenu(null); };

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const p = sel.anchorNode?.parentElement; const bg = p?.style?.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') execCommand('hiliteColor', 'transparent');
      else execCommand('hiliteColor', highlightColor);
    }
  };

  const saveNoteMetadata = async () => {
    if (!selectedNote) return;
    try { await notesAPI.update(selectedNote.id, { title: editTitle, topic: editTopic, tags: editTags }); setSelectedNote({ ...selectedNote, title: editTitle, topic: editTopic, tags: editTags }); setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title: editTitle, topic: editTopic, tags: editTags } : n)); setMessage('Saved!'); setTimeout(() => setMessage(''), 2000); }
    catch { setMessage('Failed to save'); }
  };

  // ─── AI ───
  const handleGenerateFlashcards = async () => { if (!selectedNote) return; setGeneratingFlashcards(true); setMessage('Generating flashcards...'); try { const r = await notesAPI.generateFlashcards(selectedNote.id, true); setFlashcards(r.cards); setFlashcardTitle(r.title); setFlashcardIndex(0); setFlashcardFlipped(false); setShowFlashcards(true); setMessage(''); } catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); } finally { setGeneratingFlashcards(false); } };
  const handleSummarize = async () => { if (!selectedNote) return; setGeneratingSummary(true); setMessage('Summarizing...'); try { const r = await notesAPI.summarize(selectedNote.id, true); setSummaryText(r.summary); setShowSummary(true); setMessage(''); } catch (err) { setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed')); } finally { setGeneratingSummary(false); } };

  const getHighlightedTexts = (): string[] => { if (!editorRef.current) return []; const els = editorRef.current.querySelectorAll('span[style*="background"]'); const txts: string[] = []; els.forEach(el => { const s = (el as HTMLElement).style.backgroundColor; if (s && s !== 'transparent' && s !== 'rgba(0, 0, 0, 0)') { const t = (el as HTMLElement).innerText.trim(); if (t && !txts.includes(t)) txts.push(t); } }); return txts; };

  const handleExplainClick = async () => { const hl = getHighlightedTexts(); let cached: any[] = []; if (selectedNote?.id) { try { cached = await notesAPI.getExplanations(selectedNote.id); setCachedExplanations(cached); } catch { setCachedExplanations([]); } } const all = [...new Set([...hl, ...cached.map((c:any)=>c.highlighted_text)])]; if (all.length===0){setMessage('Highlight text first.');setTimeout(()=>setMessage(''),4000);return;} setCurrentHighlights(all); setShowHighlightPicker(true); };

  const handleExplainHighlight = async (text: string) => { setShowHighlightPicker(false); setGeneratingExplanation(true); setMessage('Getting explanation...'); try { const r = await notesAPI.explain(text, selectedNote?.id); setExplanationText(r.explanation); setExplanationHighlight(r.highlighted_text); setShowExplanation(true); if (r.cached) { setMessage('From cache!'); setTimeout(()=>setMessage(''),2000); } else { setMessage(''); if (selectedNote?.id) { const nc = await notesAPI.getExplanations(selectedNote.id); setCachedExplanations(nc); } } } catch (err) { setMessage('Error: '+(err instanceof Error?err.message:'Failed')); } finally { setGeneratingExplanation(false); } };

  // Chat handler
  const handleChatSend = async () => {
    if (!selectedNote || !chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const result = await notesAPI.chat(selectedNote.id, updatedMessages);
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Chat failed'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape key: if cursor is inside a shape, move cursor out to after the shape
    if (e.key === 'Escape') {
      const sel = window.getSelection();
      if (sel?.anchorNode) {
        const shapeEl = (sel.anchorNode as HTMLElement).closest?.('.np-shape') || (sel.anchorNode.parentElement as HTMLElement)?.closest?.('.np-shape');
        if (shapeEl && editorRef.current) {
          e.preventDefault();
          // Move cursor to the paragraph after the shape
          const next = shapeEl.nextElementSibling || shapeEl.nextSibling;
          if (next) {
            const range = document.createRange();
            range.setStartBefore(next);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            // No sibling — insert a new paragraph after the shape
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            shapeEl.parentNode?.insertBefore(p, shapeEl.nextSibling);
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return;
        }
      }
    }
    if (e.key==='Tab'){e.preventDefault();if(e.shiftKey)execCommand('outdent');else{const sel=window.getSelection();if(sel?.anchorNode?.parentElement?.closest('ul, ol'))execCommand('indent');else document.execCommand('insertText',false,'\u00a0\u00a0\u00a0\u00a0');}}
    if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveNote();}
    if(e.ctrlKey&&e.key==='b'){e.preventDefault();execCommand('bold');}
    if(e.ctrlKey&&e.key==='i'){e.preventDefault();execCommand('italic');}
    if(e.ctrlKey&&e.key==='u'){e.preventDefault();execCommand('underline');}
    if(e.ctrlKey&&e.key==='h'){e.preventDefault();handleHighlight();}
    if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();insertPageBreak();}
    if(e.ctrlKey&&e.key==='f'){e.preventDefault();setShowFindReplace(true);}
  };

  // ─── Ribbon components ───
  const RibbonBtn = ({icon,label,onClick,disabled,active,small,isAccent}:{icon:string;label:string;onClick:()=>void;disabled?:boolean;active?:boolean;small?:boolean;isAccent?:boolean}) => (
    <button onClick={onClick} disabled={disabled} style={{display:'flex',flexDirection:small?'row':'column',alignItems:'center',justifyContent:'center',gap:small?'5px':'2px',padding:small?'4px 8px':'6px 10px',background:active?(darkMode?'#3f3f5a':'#d4c4b0'):'transparent',border:active?`1px solid ${t.ribbonBorder}`:'1px solid transparent',borderRadius:'3px',cursor:disabled?'not-allowed':'pointer',fontSize:small?'12px':'11px',color:isAccent?t.accent:(disabled?(darkMode?'#555':'#aaa'):t.text),minWidth:small?'auto':'52px',opacity:disabled?0.5:1,fontWeight:isAccent?600:400}}
      onMouseEnter={e=>{if(!disabled&&!active)e.currentTarget.style.background=darkMode?'#3a3a55':'#e4d8cc';}} onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}} title={label}>
      <span style={{fontSize:small?'14px':'20px',lineHeight:1}}>{icon}</span><span style={{whiteSpace:'nowrap',fontSize:small?'12px':'10px'}}>{label}</span>
    </button>
  );
  const Divider = () => <div style={{width:'1px',height:'52px',background:t.ribbonBorder,margin:'0 6px',alignSelf:'center'}} />;
  const GroupLabel = ({children}:{children:string}) => <div style={{fontSize:'10px',color:t.ribbonGroupLabel,textAlign:'center',marginTop:'2px',letterSpacing:'0.3px'}}>{children}</div>;
  const allTabs = ['home','insert','layout','design','view','ai'] as const;

  // ═══ RENDER ═══
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:"'Segoe UI','Aptos',Calibri,Arial,sans-serif",background:t.bg,overflow:'hidden'}}>
      {/* TITLE BAR */}
      <div style={{background:t.titleBar,padding:'0 12px',display:'flex',justifyContent:'space-between',alignItems:'center',height:'32px',minHeight:'32px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {onBack&&<button onClick={async()=>{await autoSave();onBack();}} style={{background:'rgba(255,255,255,0.12)',border:'none',padding:'2px 10px',borderRadius:'3px',cursor:'pointer',fontSize:'11px',color:'#fff'}}>← Back</button>}
          <img src="/monkey-loading.png" alt="" style={{width:'18px',height:'18px',objectFit:'contain'}} />
          <div style={{display:'flex',gap:'2px',marginLeft:'4px'}}>
            <button onClick={saveNote} title="Save" style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',fontSize:'13px',color:'#fff',opacity:0.8}}>💾</button>
            <button onClick={()=>execCommand('undo')} title="Undo" style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',fontSize:'13px',color:'#fff',opacity:0.8}}>↩</button>
            <button onClick={()=>execCommand('redo')} title="Redo" style={{background:'none',border:'none',cursor:'pointer',padding:'2px 6px',fontSize:'13px',color:'#fff',opacity:0.8}}>↪</button>
          </div>
          {isEditingTitle?(
            <input ref={titleInputRef} value={titleDraft} onChange={e=>setTitleDraft(e.target.value)} onBlur={commitTitle} onKeyDown={e=>{if(e.key==='Enter')commitTitle();if(e.key==='Escape')setIsEditingTitle(false);}} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'3px',color:'#fff',fontSize:'12px',padding:'1px 8px',outline:'none',width:'200px',marginLeft:'8px'}} />
          ):(
            <span onClick={startEditTitle} style={{color:'rgba(255,255,255,0.85)',fontSize:'12px',marginLeft:'8px',fontWeight:500,cursor:'pointer',padding:'1px 4px',borderRadius:'3px'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'} title="Click to rename">{selectedNote?.title||'Untitled'}</span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'11px',color:'rgba(255,255,255,0.6)'}}>{userEmail}</span>
          <button onClick={onLogout} style={{background:'rgba(255,255,255,0.1)',border:'none',padding:'2px 10px',borderRadius:'3px',cursor:'pointer',fontSize:'11px',color:'rgba(255,255,255,0.8)'}}>Sign out</button>
        </div>
      </div>

      {/* RIBBON TABS */}
      <div style={{display:'flex',alignItems:'flex-end',background:darkMode?'#1e1e2f':'#e2d6cc',paddingLeft:'4px'}}>
        <div style={{position:'relative'}}>
          <button onClick={e=>{e.stopPropagation();setActiveMenu(activeMenu==='file'?null:'file');}} style={{padding:'6px 16px',background:activeMenu==='file'?'#FF9800':(darkMode?'#5D4037':'#795548'),border:'none',cursor:'pointer',fontSize:'12px',color:'#fff',fontWeight:600,borderRadius:'3px 3px 0 0',marginRight:'2px'}}>File</button>
          {activeMenu==='file'&&(
            <div style={{position:'absolute',top:'100%',left:0,background:t.menuBg,border:`1px solid ${t.border}`,boxShadow:'0 8px 30px rgba(0,0,0,0.18)',minWidth:'260px',zIndex:1000,borderRadius:'0 0 4px 4px'}}>
              {[{icon:'📷',label:'Upload New Note',sc:'Ctrl+U',fn:()=>fileInputRef.current?.click()},{icon:'📄',label:'New Blank Note',sc:'Ctrl+N',fn:newNote},{d:true},{icon:'📁',label:'Open Note...',sc:'Ctrl+O',fn:()=>setShowNotesPanel(true)},{icon:'💾',label:'Save',sc:'Ctrl+S',fn:saveNote},{d:true},{icon:'📄',label:'Export as PDF',fn:exportToPDF},{icon:'📝',label:'Export as TXT',fn:exportToTXT},{icon:'🌐',label:'Export as HTML',fn:exportToHTML},{d:true},{icon:'🔍',label:'Find & Replace',sc:'Ctrl+F',fn:()=>setShowFindReplace(true)},{icon:'🏷️',label:'Note Info',fn:()=>setShowNoteInfo(!showNoteInfo)}].map((item,i)=>'d' in item?<div key={i} style={{borderTop:`1px solid ${t.border}`,margin:'4px 0'}}/>:(
                <div key={i} onClick={()=>{item.fn();setActiveMenu(null);}} style={{padding:'9px 20px',cursor:'pointer',fontSize:'13px',display:'flex',justifyContent:'space-between',color:t.text}} onMouseEnter={e=>e.currentTarget.style.background=t.menuHover} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span>{item.icon} {item.label}</span>{'sc' in item&&<span style={{color:t.textSecondary,fontSize:'11px'}}>{item.sc}</span>}
                </div>))}
            </div>
          )}
        </div>
        {allTabs.map(tab=>(
          <button key={tab} onClick={()=>{setActiveTab(tab);setRibbonCollapsed(activeTab===tab?!ribbonCollapsed:false);}} style={{padding:'6px 16px',border:`1px solid ${activeTab===tab?t.ribbonBorder:'transparent'}`,borderBottom:activeTab===tab?`1px solid ${t.ribbonBg}`:`1px solid ${t.ribbonBorder}`,background:activeTab===tab?t.tabActive:'transparent',cursor:'pointer',fontSize:'12px',color:tab==='ai'?t.accent:(activeTab===tab?t.tabActiveText:t.tabText),fontWeight:activeTab===tab?600:400,borderRadius:'3px 3px 0 0',marginRight:'1px',marginBottom:activeTab===tab?'-1px':'0',zIndex:activeTab===tab?2:1,position:'relative'}}>
            {tab==='ai'?'🧠 AI':tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" multiple onChange={handleFileSelect} style={{display:'none'}} />
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageInsert} style={{display:'none'}} />
      </div>

      {/* RIBBON PANEL */}
      {!ribbonCollapsed&&(
        <div style={{background:t.ribbonBg,borderBottom:`1px solid ${t.ribbonBorder}`,padding:'4px 12px 2px',display:'flex',alignItems:'flex-start',minHeight:'82px',overflowX:'auto'}}>
          {activeTab==='home'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginRight:'4px'}}><div style={{display:'flex',alignItems:'flex-start',gap:'2px'}}><RibbonBtn icon="📋" label="Paste" onClick={()=>navigator.clipboard.readText().then(t=>document.execCommand('insertText',false,t)).catch(()=>{})}/><div style={{display:'flex',flexDirection:'column',gap:'1px'}}><RibbonBtn icon="✂️" label="Cut" onClick={()=>document.execCommand('cut')} small/><RibbonBtn icon="📑" label="Copy" onClick={()=>document.execCommand('copy')} small/></div></div><GroupLabel>Clipboard</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap'}}>
              <select value={fontFamily} onChange={e=>{setFontFamily(e.target.value);execCommand('fontName',e.target.value);}} style={{padding:'3px 6px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'12px',minWidth:'110px',background:t.inputBg,color:t.text,height:'24px'}}>{['Calibri','Arial','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Garamond','Palatino','Cambria'].map(f=><option key={f} value={f}>{f}</option>)}</select>
              <select value={fontSize} onChange={e=>{setFontSize(e.target.value);execCommand('fontSize',e.target.value);}} style={{padding:'3px 4px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'12px',width:'48px',background:t.inputBg,color:t.text,height:'24px'}}>{[['1','8'],['2','10'],['3','12'],['4','14'],['5','18'],['6','24'],['7','36']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              <div style={{display:'flex',gap:'1px',marginLeft:'2px'}}>
                <button onClick={()=>execCommand('bold')} style={{...fmtBtnStyle,fontWeight:'bold'}}>B</button>
                <button onClick={()=>execCommand('italic')} style={{...fmtBtnStyle,fontStyle:'italic'}}>I</button>
                <button onClick={()=>execCommand('underline')} style={{...fmtBtnStyle,textDecoration:'underline'}}>U</button>
                <button onClick={()=>execCommand('strikeThrough')} style={{...fmtBtnStyle,textDecoration:'line-through',fontSize:'11px'}}>ab</button>
                <button onClick={()=>execCommand('subscript')} style={{...fmtBtnStyle,fontSize:'11px'}}>x₂</button>
                <button onClick={()=>execCommand('superscript')} style={{...fmtBtnStyle,fontSize:'11px'}}>x²</button>
                <div style={{position:'relative',display:'inline-flex'}}><button onClick={handleHighlight} style={{...fmtBtnStyle,background:highlightColor,color:'#333',fontWeight:'bold',borderBottom:`3px solid ${highlightColor}`}}>H</button><input type="color" value={highlightColor} onChange={e=>setHighlightColor(e.target.value)} style={{width:'14px',height:'26px',border:'none',cursor:'pointer',padding:0,background:'transparent'}}/></div>
                <div style={{position:'relative',display:'inline-flex'}}><span style={{...fmtBtnStyle,borderBottom:'3px solid red',pointerEvents:'none'}}>A</span><input type="color" onChange={e=>execCommand('foreColor',e.target.value)} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}}/></div>
              </div>
            </div><GroupLabel>Font</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'1px',alignItems:'center'}}>
              <button onClick={()=>execCommand('insertUnorderedList')} style={fmtBtnStyle} title="Bullets">•≡</button>
              <button onClick={()=>execCommand('insertOrderedList')} style={fmtBtnStyle}>1.</button>
              <button onClick={()=>execCommand('outdent')} style={fmtBtnStyle}>⇤</button>
              <button onClick={()=>execCommand('indent')} style={fmtBtnStyle}>⇥</button>
              <div style={{width:'1px',height:'20px',background:t.border,margin:'0 3px'}}/>
              <button onClick={()=>execCommand('justifyLeft')} style={fmtBtnStyle}>≡</button>
              <button onClick={()=>execCommand('justifyCenter')} style={fmtBtnStyle}>☰</button>
              <button onClick={()=>execCommand('justifyRight')} style={fmtBtnStyle}>⫸</button>
              <button onClick={()=>execCommand('justifyFull')} style={fmtBtnStyle}>⊞</button>
              <div style={{width:'1px',height:'20px',background:t.border,margin:'0 3px'}}/>
              <select value={lineSpacing} onChange={e=>setLineSpacing(e.target.value)} style={{padding:'3px 4px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'11px',width:'50px',background:t.inputBg,color:t.text,height:'24px'}}><option value="1">1.0</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option></select>
            </div><GroupLabel>Paragraph</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'2px'}}>
              <RibbonBtn icon="🔍" label="Find" onClick={()=>setShowFindReplace(true)} small/>
              <select value={noteType} onChange={e=>setNoteType(e.target.value as any)} style={{padding:'3px 8px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'11px',background:t.inputBg,color:t.text,height:'24px'}}><option value="default">📝 Default</option><option value="lecture">📚 Lecture</option><option value="meeting">📋 Meeting</option></select>
            </div><GroupLabel>Editing</GroupLabel></div>
          </>)}

          {activeTab==='insert'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <div style={{position:'relative'}}>
                <RibbonBtn icon="🗓️" label="Table" onClick={()=>setShowTableGrid(!showTableGrid)}/>
                {showTableGrid&&(<div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,background:t.menuBg,border:`1px solid ${t.border}`,borderRadius:'4px',padding:'10px',zIndex:1000,boxShadow:'0 4px 16px rgba(0,0,0,0.15)'}}>
                  <div style={{fontSize:'11px',color:t.textSecondary,marginBottom:'6px'}}>{tableHoverRow>0?`${tableHoverRow} × ${tableHoverCol} Table`:'Insert Table'}</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(8, 18px)',gap:'2px'}}>{Array.from({length:48},(_,i)=>{const r=Math.floor(i/8)+1;const c=(i%8)+1;return(<div key={i} onClick={()=>insertTable(r,c)} onMouseEnter={()=>{setTableHoverRow(r);setTableHoverCol(c);}} style={{width:'16px',height:'16px',border:`1px solid ${r<=tableHoverRow&&c<=tableHoverCol?'#FF9800':t.border}`,background:r<=tableHoverRow&&c<=tableHoverCol?(darkMode?'#3a2a1a':'#FFF3E0'):'transparent',cursor:'pointer',borderRadius:'1px'}}/>);})}</div>
                </div>)}
              </div>
              <RibbonBtn icon="🖼️" label="Picture" onClick={()=>imageInputRef.current?.click()}/>
              <RibbonBtn icon="📷" label="Upload" onClick={()=>fileInputRef.current?.click()}/>
              <RibbonBtn icon="📄" label="Blank" onClick={newNote}/>
            </div><GroupLabel>Insert</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <RibbonBtn icon="📦" label="Text Box" onClick={insertTextBox}/><RibbonBtn icon="🔷" label="Rect" onClick={()=>insertShape('rect')}/><RibbonBtn icon="⬭" label="Rounded" onClick={()=>insertShape('rounded')}/><RibbonBtn icon="⚫" label="Circle" onClick={()=>insertShape('circle')}/><RibbonBtn icon="💬" label="Callout" onClick={()=>insertShape('callout')}/>
            </div><GroupLabel>Shapes</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <RibbonBtn icon="📃" label="Page Break" onClick={insertPageBreak}/><RibbonBtn icon="📄" label="New Page" onClick={insertNewPage}/><RibbonBtn icon="➖" label="Line" onClick={()=>execCommand('insertHorizontalRule')}/><RibbonBtn icon="🕐" label="Date/Time" onClick={insertDateTime}/>
            </div><GroupLabel>Page</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <RibbonBtn icon="🔝" label="Header" onClick={insertHeader}/><RibbonBtn icon="🔚" label="Footer" onClick={insertFooter}/>
            </div><GroupLabel>Header/Footer</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'2px',flexWrap:'wrap'}}>
              {['©','®','™','→','←','↑','↓','•','—','…','°','±','÷','×','€','£','¥','§','¶','†','‡','∞','≈','≠','≤','≥'].map(s=>(<button key={s} onClick={()=>insertSymbol(s)} style={{...fmtBtnStyle,fontSize:'14px',minWidth:'24px',height:'24px'}}>{s}</button>))}
            </div><GroupLabel>Symbols</GroupLabel></div>
          </>)}

          {activeTab==='layout'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>{(['normal','narrow','wide'] as const).map(m=>(<RibbonBtn key={m} icon={m==='normal'?'📐':m==='narrow'?'📏':'📎'} label={m.charAt(0).toUpperCase()+m.slice(1)} onClick={()=>setPageMargin(m)} active={pageMargin===m}/>))}</div><GroupLabel>Margins</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}><RibbonBtn icon="📄" label="Portrait" onClick={()=>setPageOrientation('portrait')} active={pageOrientation==='portrait'}/><RibbonBtn icon="🖼️" label="Landscape" onClick={()=>setPageOrientation('landscape')} active={pageOrientation==='landscape'}/></div><GroupLabel>Orientation</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>{[1,2,3].map(n=><RibbonBtn key={n} icon={String(n)} label={n===1?'One':n===2?'Two':'Three'} onClick={()=>setColumnCount(n)} active={columnCount===n}/>)}</div><GroupLabel>Columns</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}><RibbonBtn icon="⬜" label="Indent ←" onClick={()=>execCommand('outdent')}/><RibbonBtn icon="⬜" label="Indent →" onClick={()=>execCommand('indent')}/></div><GroupLabel>Indent</GroupLabel></div>
          </>)}

          {activeTab==='design'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'3px'}}>{['',...(darkMode?['#2a2a3e','#1e2e3e','#2e1e3e','#1e3e2e','#3e2e1e','#2e2e2e']:['#FFF8E1','#E3F2FD','#F3E5F5','#E8F5E9','#FBE9E7','#F5F5F5'])].map((c,i)=>(<button key={i} onClick={()=>setPageColor(c)} style={{width:'28px',height:'28px',background:c||(darkMode?'#252542':'#fff'),border:`2px solid ${pageColor===c?'#FF9800':t.border}`,borderRadius:'4px',cursor:'pointer'}} title={c||'Default'}/>))}</div><GroupLabel>Page Color</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}><RibbonBtn icon="🔲" label={pageBorderEnabled?'Remove':'Add'} onClick={()=>setPageBorderEnabled(!pageBorderEnabled)} active={pageBorderEnabled}/></div><GroupLabel>Page Border</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px',alignItems:'center'}}><input type="text" placeholder="Watermark..." value={watermarkText} onChange={e=>setWatermarkText(e.target.value)} style={{padding:'3px 8px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'11px',width:'120px',background:t.inputBg,color:t.text,height:'24px'}}/>{watermarkText&&<button onClick={()=>setWatermarkText('')} style={{...fmtBtnStyle,fontSize:'11px'}}>✕</button>}</div><GroupLabel>Watermark</GroupLabel></div>
          </>)}

          {activeTab==='view'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <RibbonBtn icon="📷" label="Image" onClick={()=>setShowImage(!showImage)} active={showImage}/>
              <RibbonBtn icon="🏷️" label="Info" onClick={()=>setShowNoteInfo(!showNoteInfo)} active={showNoteInfo}/>
            </div><GroupLabel>Panels</GroupLabel></div><Divider/>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'3px',alignItems:'center'}}>
              <button onClick={()=>setZoom(Math.max(50,zoom-25))} style={fmtBtnStyle}>−</button>
              <select value={zoom} onChange={e=>setZoom(Number(e.target.value))} style={{padding:'3px 4px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'11px',width:'58px',background:t.inputBg,color:t.text,height:'24px'}}>{[50,75,100,125,150,200].map(v=><option key={v} value={v}>{v}%</option>)}</select>
              <button onClick={()=>setZoom(Math.min(200,zoom+25))} style={fmtBtnStyle}>+</button>
            </div><GroupLabel>Zoom</GroupLabel></div>
          </>)}

          {activeTab==='ai'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{display:'flex',gap:'4px'}}>
              <FeatureGate feature="flashcards" token={localStorage.getItem('token')} darkMode={darkMode}><RibbonBtn icon="🃏" label="Flashcards" onClick={handleGenerateFlashcards} disabled={!selectedNote||generatingFlashcards} isAccent/></FeatureGate>
              <RibbonBtn icon="📋" label="Summarize" onClick={handleSummarize} disabled={!selectedNote||generatingSummary} isAccent/>
              <RibbonBtn icon="💡" label="Explain" onClick={handleExplainClick} disabled={!selectedNote||generatingExplanation} isAccent/>
              <FeatureGate feature="chat" token={localStorage.getItem('token')} darkMode={darkMode}><RibbonBtn icon="💬" label="Chat" onClick={()=>setShowChat(true)} disabled={!selectedNote} isAccent/></FeatureGate>
            </div><GroupLabel>AI Tools — Gemini</GroupLabel></div>
            <div style={{marginLeft:'auto',minWidth:'280px',maxWidth:'360px'}}><UsageBanner token={localStorage.getItem('token')} darkMode={darkMode}/></div>
          </>)}
        </div>
      )}

      {/* MESSAGE */}
      {message&&(<div style={{padding:'5px 15px',fontSize:'12px',display:'flex',justifyContent:'space-between',alignItems:'center',background:message.includes('Error')?'#fde8e8':t.accentLight,color:message.includes('Error')?'#c62828':t.text}}><span>{uploading?'🍌 Peeling...':message}</span><button onClick={()=>setMessage('')} style={{background:'none',border:'none',cursor:'pointer',color:t.text,fontSize:'14px'}}>✕</button></div>)}

      {/* FIND & REPLACE */}
      {showFindReplace&&(<div style={{padding:'6px 15px',background:t.ribbonBg,borderBottom:`1px solid ${t.border}`,display:'flex',gap:'8px',alignItems:'center',fontSize:'12px'}}>
        <span style={{color:t.textSecondary}}>Find:</span><input value={findText} onChange={e=>setFindText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleFind();}} style={{padding:'3px 8px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'12px',background:t.inputBg,color:t.text,width:'150px'}} autoFocus/>
        <button onClick={handleFind} style={{...fmtBtnStyle,fontSize:'11px',border:`1px solid ${t.border}`}}>Find</button>
        <span style={{color:t.textSecondary,marginLeft:'8px'}}>Replace:</span><input value={replaceText} onChange={e=>setReplaceText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleReplace();}} style={{padding:'3px 8px',border:`1px solid ${t.border}`,borderRadius:'2px',fontSize:'12px',background:t.inputBg,color:t.text,width:'150px'}}/>
        <button onClick={handleReplace} style={{...fmtBtnStyle,fontSize:'11px',border:`1px solid ${t.border}`}}>Replace All</button>
        <button onClick={()=>{clearFindHighlights();setShowFindReplace(false);setFindText('');setReplaceText('');}} style={{...fmtBtnStyle,fontSize:'11px'}}>✕</button>
      </div>)}

      {/* MAIN */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Notes Panel (accessible from File > Open) */}
        {showNotesPanel&&(<div style={{width:'240px',background:t.cardBg,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 12px',borderBottom:`1px solid ${t.border}`,fontWeight:600,color:t.text,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span>📁 Notes ({notes.length})</span><button onClick={()=>setShowNotesPanel(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:t.textSecondary}}>✕</button></div>
          <div style={{padding:'8px 10px',borderBottom:`1px solid ${t.border}`}}><input type="text" placeholder="Search..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{width:'100%',padding:'6px 10px',border:`1px solid ${t.border}`,borderRadius:'3px',fontSize:'12px',outline:'none',boxSizing:'border-box',background:t.inputBg,color:t.text}}/></div>
          <div style={{flex:1,overflowY:'auto',padding:'6px 8px'}}>{loading?<p style={{color:t.textSecondary,fontSize:'12px',padding:'10px'}}>Loading...</p>:notes.length===0?<p style={{color:t.textSecondary,fontSize:'12px',padding:'10px'}}>No notes yet.</p>:filteredNotes.map(note=>(<div key={note.id} onClick={()=>viewNote(note)} style={{padding:'8px 10px',marginBottom:'3px',cursor:'pointer',borderRadius:'3px',background:selectedNote?.id===note.id?t.accentLight:'transparent',borderLeft:selectedNote?.id===note.id?'3px solid #FF9800':'3px solid transparent'}} onMouseEnter={e=>{if(selectedNote?.id!==note.id)e.currentTarget.style.background=t.menuHover;}} onMouseLeave={e=>{if(selectedNote?.id!==note.id)e.currentTarget.style.background='transparent';}}><div style={{fontSize:'12px',fontWeight:500,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{note.title||'Untitled'}</div><div style={{fontSize:'10px',color:t.textSecondary,marginTop:'2px'}}>{new Date(note.created_at).toLocaleDateString()}</div></div>))}</div>
        </div>)}

        {/* Image Panel */}
        {showImage&&selectedNote&&(<div style={{width:'280px',background:t.cardBg,borderRight:`1px solid ${t.border}`,padding:'12px',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}><span style={{fontSize:'13px',fontWeight:600,color:t.text}}>📷 Original</span><button onClick={()=>setShowImage(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:t.textSecondary}}>✕</button></div>{selectedNote.image_url&&<img src={selectedNote.image_url} alt="Note" style={{maxWidth:'100%',borderRadius:'4px',border:`1px solid ${t.border}`}}/>}</div>)}

        {/* Note Info (no folder) */}
        {showNoteInfo&&selectedNote&&(<div style={{width:'220px',background:t.cardBg,borderRight:`1px solid ${t.border}`,padding:'12px',overflowY:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><span style={{fontSize:'13px',fontWeight:600,color:t.text}}>🏷️ Note Info</span><button onClick={()=>setShowNoteInfo(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:t.textSecondary}}>✕</button></div>
          {[{l:'Topic',v:editTopic,s:setEditTopic},{l:'Tags',v:editTags,s:setEditTags}].map(f=>(<div key={f.l} style={{marginBottom:'10px'}}><label style={{fontSize:'10px',fontWeight:'bold',color:t.textSecondary,textTransform:'uppercase',display:'block',marginBottom:'3px'}}>{f.l}</label><input type="text" value={f.v} onChange={e=>f.s(e.target.value)} style={{width:'100%',padding:'5px 8px',border:`1px solid ${t.border}`,borderRadius:'3px',fontSize:'12px',boxSizing:'border-box',background:t.inputBg,color:t.text}}/></div>))}
          <button onClick={saveNoteMetadata} style={{width:'100%',padding:'6px',background:'linear-gradient(135deg,#FFC107,#FF9800)',color:'#5D4037',border:'none',borderRadius:'3px',cursor:'pointer',fontSize:'12px',fontWeight:'bold'}}>Save Info</button>
        </div>)}

        {/* EDITOR */}
        <div ref={editorScrollRef} onScroll={handleEditorScroll} style={{flex:1,background:t.bg,overflowY:'auto',padding:'20px 30px',position:'relative'}}>
          <div style={{maxWidth:pageOrientation==='landscape'?'1100px':'850px',margin:'0 auto',transform:`scale(${zoom/100})`,transformOrigin:'top center'}}>
            {/* Ruler */}
            <div style={{height:'20px',background:t.cardBg,borderBottom:`1px solid ${t.border}`,position:'relative',overflow:'hidden',borderRadius:'4px 4px 0 0',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              {Array.from({length:17},(_,i)=>(<div key={i} style={{position:'absolute',left:`${80+i*(690/16)}px`,top:'10px',width:'1px',height:i%2===0?'10px':'6px',background:t.border}}>{i%2===0&&<span style={{position:'absolute',top:'-12px',left:'-4px',fontSize:'8px',color:t.textSecondary}}>{i/2}</span>}</div>))}
            </div>
            {/* Page container */}
            <div style={{position:'relative'}}>
              <div ref={editorRef} contentEditable className="notepeel-editor"
                style={{padding:margins[pageMargin],fontSize:'16px',fontFamily:fontFamily,lineHeight:lineSpacing,outline:'none',wordWrap:'break-word',overflowWrap:'break-word',whiteSpace:'normal',color:t.text,minHeight:`${PAGE_HEIGHT}px`,position:'relative',zIndex:1,columnCount:columnCount,columnGap:'30px',background:pageColor||t.editorBg,boxShadow:'0 2px 12px rgba(0,0,0,0.08)',borderRadius:'0 0 4px 4px',border:pageBorderEnabled?`3px solid ${darkMode?'#666':'#999'}`:'none'}}
                onKeyDown={handleKeyDown} onInput={updateCounts} suppressContentEditableWarning/>
              {/* Watermark overlay */}
              {watermarkText&&<div style={{position:'absolute',top:0,left:0,right:0,height:`${PAGE_HEIGHT}px`,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none',zIndex:0}}>
                <span style={{fontSize:'72px',color:darkMode?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',transform:'rotate(-35deg)',fontWeight:'bold',letterSpacing:'8px',userSelect:'none'}}>{watermarkText}</span>
              </div>}
              {/* Page gap overlays */}
              {Array.from({length:Math.max(0,pageCount-1)},(_,i)=>(
                <div key={`gap-${i}`} style={{
                  position:'absolute',
                  top:`${(i+1)*PAGE_HEIGHT}px`,
                  left:'-4px',right:'-4px',
                  height:'32px',
                  background:t.bg,
                  zIndex:10,
                  pointerEvents:'none',
                  boxShadow:`inset 0 4px 6px -4px rgba(0,0,0,${darkMode?'0.5':'0.15'}), inset 0 -4px 6px -4px rgba(0,0,0,${darkMode?'0.5':'0.15'})`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  <span style={{fontSize:'9px',color:t.textSecondary,letterSpacing:'1px',background:t.bg,padding:'0 10px'}}>— PAGE {i+2} —</span>
                </div>
              ))}
            </div>
            <style>{`
              ${darkMode?`.notepeel-editor [style*="color: #3E2723"],.notepeel-editor [style*="color:#3E2723"],.notepeel-editor [style*="color: #5D4037"],.notepeel-editor [style*="color:#5D4037"],.notepeel-editor [style*="color: #333"],.notepeel-editor [style*="color:#333"]{color:#e4e4e7!important}.notepeel-editor h2[style]{color:#e4e4e7!important}`:''}
              .notepeel-editor .np-shape{color:${t.text};cursor:text;transition:box-shadow 0.15s}
              .notepeel-editor .np-shape:hover:not(:focus){outline:1px dashed ${t.border}}
              .notepeel-editor .np-shape-1{background:${t.shapeBg};border-color:${t.shapeBorder}!important}
              .notepeel-editor .np-shape-2{background:${t.shapeBg2};border-color:${t.shapeBorder2}!important}
              .notepeel-editor .np-shape-3{background:${t.shapeBg3};border-color:${t.shapeBorder3}!important}
              .notepeel-editor .np-shape-4{background:${t.shapeBg4};border-color:${t.shapeBorder4}!important}
              @media print{.notepeel-editor{background-color:white!important}}
              .notepeel-editor table{border-collapse:collapse;width:100%}
              .notepeel-editor table td,.notepeel-editor table th{border:1px solid ${t.tableBorder};padding:8px 12px;min-height:20px;vertical-align:top}
              .notepeel-editor table td:focus,.notepeel-editor table th:focus{outline:2px solid #FF9800}
              .notepeel-editor img{max-width:100%;height:auto;border-radius:4px;margin:8px 0}
              .notepeel-editor img:hover{outline:2px solid #FF9800;cursor:pointer}
              ${darkMode?`.notepeel-editor span[style*="background-color: yellow"],.notepeel-editor span[style*="background-color: rgb(255, 255, 0)"],.notepeel-editor span[style*="background-color:#FFFF00"]{background-color:#8B8000!important;color:#fff!important}
              .notepeel-editor span[style*="background-color"]{color:#fff!important}`:``}
              .np-header:hover button,.np-footer:hover button{opacity:1!important}
              .np-header button,.np-footer button{opacity:0;transition:opacity 0.2s}
            `}</style>
          </div>
        </div>
        {/* Shape selection handles — fixed overlay so positioning is exact */}
        {selectedShape && (() => {
          const sh = getShapeHandles();
          if (!sh) return null;
          // Convert to viewport-fixed coordinates
          const scrollRect = editorScrollRef.current!.getBoundingClientRect();
          const vTop = scrollRect.top + sh.top;
          const vLeft = scrollRect.left + sh.left;
          return (
            <div className="np-shape-handles" style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',pointerEvents:'none',zIndex:9000}}>
              {/* Selection border */}
              <div style={{position:'absolute',top:vTop,left:vLeft,width:sh.w,height:sh.h,border:'2px solid #FF9800',pointerEvents:'none',boxSizing:'border-box'}}/>
              {/* 8 resize handles */}
              {sh.handles.map((h,i) => (
                <div key={i}
                  onMouseDown={(e) => handleShapeMouseDown(e, h.action)}
                  style={{
                    position:'absolute',
                    top: scrollRect.top + h.y,
                    left: scrollRect.left + h.x,
                    width:sh.hs,height:sh.hs,
                    background:'#fff',border:'2px solid #FF9800',borderRadius:'50%',
                    cursor:h.cursor,pointerEvents:'auto',zIndex:9002,
                    boxShadow:'0 1px 3px rgba(0,0,0,0.25)',
                  }}
                />
              ))}
              {/* Move handle — the shape interior */}
              <div
                onMouseDown={(e) => handleShapeMouseDown(e, 'move')}
                style={{
                  position:'absolute',top:vTop+2,left:vLeft+2,
                  width:sh.w-4,height:sh.h-4,
                  cursor:'move',pointerEvents:'auto',zIndex:9001,
                }}
              />
              {/* Rotate handle — line + circle above shape */}
              <div style={{
                position:'absolute',
                top:vTop - 28,
                left:vLeft + sh.w/2 - 1,
                width:2,height:22,
                background:'#FF9800',
                pointerEvents:'none',
              }}/>
              <div
                onMouseDown={(e) => handleShapeMouseDown(e, 'rotate')}
                style={{
                  position:'absolute',
                  top:vTop - 40,
                  left:vLeft + sh.w/2 - 10,
                  width:20,height:20,
                  background:'#fff',border:'2px solid #FF9800',borderRadius:'50%',
                  cursor:'grab',pointerEvents:'auto',zIndex:9002,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
                  fontSize:'12px',color:'#FF9800',fontWeight:'bold',
                }}>↻</div>
            </div>
          );
        })()}
      </div>

      {/* STATUS BAR */}
      <div style={{background:t.statusBar,padding:'3px 15px',fontSize:'11px',color:darkMode?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.85)',display:'flex',justifyContent:'space-between',alignItems:'center',height:'22px',minHeight:'22px'}}>
        <span>Page {currentPage} of {pageCount}</span>
        <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
          <span>{wordCount} Words</span><span>{charCount} Characters</span>
          <div style={{display:'flex',gap:'3px',alignItems:'center'}}>
            <button onClick={()=>setZoom(Math.max(50,zoom-25))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:'11px',padding:'0 2px'}}>−</button>
            <div style={{width:'50px',height:'3px',background:'rgba(255,255,255,0.2)',borderRadius:'2px',position:'relative'}}><div style={{position:'absolute',left:`${((zoom-50)/150)*100}%`,top:'-3px',width:'8px',height:'8px',borderRadius:'50%',background:'#FF9800'}}/></div>
            <button onClick={()=>setZoom(Math.min(200,zoom+25))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:'11px',padding:'0 2px'}}>+</button>
            <span style={{marginLeft:'4px',minWidth:'28px'}}>{zoom}%</span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showFlashcards&&flashcards.length>0&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setShowFlashcards(false)}><div style={{background:t.cardBg,borderRadius:'12px',padding:'28px',maxWidth:'520px',width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}><h2 style={{margin:0,color:t.text,fontSize:'17px'}}>🃏 {flashcardTitle}</h2><button onClick={()=>setShowFlashcards(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:t.textSecondary}}>✕</button></div>
        <div style={{display:'flex',gap:'2px',marginBottom:'16px'}}>{flashcards.map((_,i)=><div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background:i<=flashcardIndex?'#FF9800':(darkMode?'#3f3f5a':'#e0e0e0')}}/>)}</div>
        <div onClick={()=>setFlashcardFlipped(!flashcardFlipped)} style={{minHeight:'180px',borderRadius:'8px',padding:'28px',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',cursor:'pointer',textAlign:'center',background:flashcardFlipped?(darkMode?'#1e3a2f':'#E8F5E9'):t.accentLight,border:`1px solid ${flashcardFlipped?'#A5D6A7':'#FFB74D'}`}}>
          <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'1px',color:t.textSecondary,marginBottom:'10px'}}>{flashcardFlipped?'ANSWER':'QUESTION'} — {flashcardIndex+1}/{flashcards.length}</div>
          <div style={{fontSize:'16px',lineHeight:'1.6',color:t.text}}>{flashcardFlipped?flashcards[flashcardIndex].answer:flashcards[flashcardIndex].question}</div>
          <div style={{fontSize:'11px',color:t.textSecondary,marginTop:'14px'}}>Click to {flashcardFlipped?'see question':'reveal answer'}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:'16px'}}>
          <button onClick={()=>{setFlashcardIndex(Math.max(0,flashcardIndex-1));setFlashcardFlipped(false);}} disabled={flashcardIndex===0} style={{padding:'6px 16px',border:`1px solid ${t.border}`,borderRadius:'4px',background:t.cardBg,cursor:flashcardIndex===0?'not-allowed':'pointer',color:t.text,opacity:flashcardIndex===0?0.5:1}}>Previous</button>
          <span style={{color:t.textSecondary,fontSize:'12px',alignSelf:'center'}}>{flashcardIndex+1}/{flashcards.length}</span>
          <button onClick={()=>{setFlashcardIndex(Math.min(flashcards.length-1,flashcardIndex+1));setFlashcardFlipped(false);}} disabled={flashcardIndex===flashcards.length-1} style={{padding:'6px 16px',border:'none',borderRadius:'4px',background:flashcardIndex===flashcards.length-1?'#ccc':'linear-gradient(135deg,#FFC107,#FF9800)',color:'#5D4037',cursor:flashcardIndex===flashcards.length-1?'not-allowed':'pointer',fontWeight:'bold'}}>Next</button>
        </div>
      </div></div>)}

      {showSummary&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setShowSummary(false)}><div style={{background:t.cardBg,borderRadius:'12px',padding:'28px',maxWidth:'560px',width:'90%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}><h2 style={{margin:0,color:'#2E7D32',fontSize:'17px'}}>📋 AI Summary</h2><button onClick={()=>setShowSummary(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:t.textSecondary}}>✕</button></div>
        <div style={{background:darkMode?'#1e3a2f':'#E8F5E9',borderRadius:'8px',padding:'20px',lineHeight:'1.8',color:t.text,fontSize:'14px',whiteSpace:'pre-wrap'}}>{summaryText}</div>
        <div style={{marginTop:'14px',textAlign:'right'}}><button onClick={()=>{navigator.clipboard.writeText(summaryText);setMessage('Copied!');setTimeout(()=>setMessage(''),2000);}} style={{padding:'6px 16px',background:darkMode?'#1e3a2f':'#E8F5E9',border:'1px solid #A5D6A7',borderRadius:'4px',cursor:'pointer',fontSize:'12px',color:'#2E7D32'}}>Copy</button></div>
      </div></div>)}

      {showHighlightPicker&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setShowHighlightPicker(false)}><div style={{background:t.cardBg,borderRadius:'12px',padding:'28px',maxWidth:'520px',width:'90%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}><h2 style={{margin:0,color:t.accent,fontSize:'17px'}}>💡 Select Highlight</h2><button onClick={()=>setShowHighlightPicker(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:t.textSecondary}}>✕</button></div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{currentHighlights.map((text,idx)=>{const c=cachedExplanations.find(c=>c.highlighted_text===text);return(<div key={idx} onClick={()=>handleExplainHighlight(text)} style={{background:darkMode?'#8B8000':'#FFEB3B',borderRadius:'6px',padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{color:darkMode?'#fff':'#5D4037',fontSize:'13px',flex:1}}>"{text.length>80?text.slice(0,80)+'...':text}"</span><span style={{background:c?'#4CAF50':'#FF9800',color:'#fff',padding:'2px 6px',borderRadius:'10px',fontSize:'10px',fontWeight:'bold'}}>{c?'Cached':'New'}</span></div>);})}</div>
        {currentHighlights.length===0&&<div style={{textAlign:'center',padding:'24px',color:t.textSecondary}}><div style={{fontSize:'36px',marginBottom:'8px'}}>🖍️</div><p>No highlights found.</p></div>}
      </div></div>)}

      {showExplanation&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setShowExplanation(false)}><div style={{background:t.cardBg,borderRadius:'12px',padding:'28px',maxWidth:'520px',width:'90%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}><h2 style={{margin:0,color:t.accent,fontSize:'17px'}}>💡 AI Explanation</h2><button onClick={()=>setShowExplanation(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:t.textSecondary}}>✕</button></div>
        {explanationHighlight&&<div style={{background:darkMode?'#8B8000':'#FFEB3B',borderRadius:'6px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px',color:darkMode?'#fff':'#5D4037',fontStyle:'italic'}}><strong>Explaining:</strong> "{explanationHighlight.length>100?explanationHighlight.slice(0,100)+'...':explanationHighlight}"</div>}
        <div style={{background:t.accentLight,borderRadius:'8px',padding:'20px',lineHeight:'1.8',color:t.text,fontSize:'14px',whiteSpace:'pre-wrap'}}>{explanationText}</div>
      </div></div>)}

      {showChat&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}} onClick={()=>setShowChat(false)}><div style={{background:t.cardBg,borderRadius:'12px',width:'90%',maxWidth:'560px',height:'70vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px 12px',borderBottom:`1px solid ${t.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 style={{margin:0,color:'#7C4DFF',fontSize:'17px'}}>💬 Study Chat</h2>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <button onClick={()=>{setChatMessages([]);setChatInput('');}} style={{background:'none',border:`1px solid ${t.border}`,borderRadius:'6px',padding:'4px 10px',fontSize:'11px',color:t.textSecondary,cursor:'pointer'}}>Clear</button>
            <button onClick={()=>setShowChat(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:t.textSecondary}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
          {chatMessages.length===0&&(<div style={{textAlign:'center',color:t.textSecondary,marginTop:'60px'}}><div style={{fontSize:'36px',marginBottom:'12px'}}>💬</div><p style={{fontSize:'14px',margin:0}}>Ask questions about your notes!</p><p style={{fontSize:'12px',margin:'8px 0 0',opacity:0.7}}>The AI will answer based on this note's content.</p></div>)}
          {chatMessages.map((msg,i)=>(<div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:'12px'}}><div style={{maxWidth:'80%',padding:'12px 16px',borderRadius:msg.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',background:msg.role==='user'?'linear-gradient(135deg, #7C4DFF, #651FFF)':(darkMode?'#3a3a5a':'#f3f0ff'),color:msg.role==='user'?'#fff':t.text,fontSize:'14px',lineHeight:'1.6',whiteSpace:'pre-wrap'}}>{msg.content}</div></div>))}
          {chatLoading&&(<div style={{display:'flex',justifyContent:'flex-start',marginBottom:'12px'}}><div style={{padding:'12px 16px',borderRadius:'18px 18px 18px 4px',background:darkMode?'#3a3a5a':'#f3f0ff',color:t.textSecondary,fontSize:'14px'}}>Thinking...</div></div>)}
          {chatMessages.length>=15&&(<div style={{textAlign:'center',padding:'8px',fontSize:'12px',color:t.textSecondary}}>Tip: For best results, start a fresh session after many turns.</div>)}
          <div ref={chatEndRef}/>
        </div>
        <div style={{padding:'12px 24px 16px',borderTop:`1px solid ${t.border}`,display:'flex',gap:'8px'}}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleChatSend();}}} placeholder="Ask about your notes..." style={{flex:1,padding:'10px 14px',borderRadius:'8px',border:`1px solid ${t.border}`,background:darkMode?'#1a1a2e':'#fff',color:t.text,fontSize:'14px',outline:'none'}}/>
          <button onClick={handleChatSend} disabled={!chatInput.trim()||chatLoading} style={{padding:'10px 18px',borderRadius:'8px',border:'none',background:(!chatInput.trim()||chatLoading)?(darkMode?'#3f3f5a':'#e0e0e0'):'linear-gradient(135deg, #7C4DFF, #651FFF)',color:(!chatInput.trim()||chatLoading)?t.textSecondary:'#fff',fontWeight:700,fontSize:'14px',cursor:(!chatInput.trim()||chatLoading)?'not-allowed':'pointer'}}>Send</button>
        </div>
      </div></div>)}

      {showPeelingModal&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000,flexDirection:'column',gap:'16px'}}><img src="/monkey-loading.png" alt="Loading" style={{width:'160px',height:'auto',animation:'bounce 1s ease-in-out infinite'}}/><div style={{color:'#FFC107',fontSize:'20px',fontWeight:'bold'}}>🍌 Peeling your notes...</div><div style={{color:'#fff',fontSize:'13px',opacity:0.7}}>This may take a few seconds</div><style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style></div>)}
    </div>
  );
}
