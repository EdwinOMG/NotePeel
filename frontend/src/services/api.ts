import type { 
  UserCreate, 
  UserLogin, 
  AuthToken, 
  User, 
  Note, 
  NoteWithImage,
  Notebook,
  NotebookWithNotes,
  NotebookCreate,
  NotebookUpdate,
  Categories,
  FlashcardSet
} from '../types';

const API_URL = 'http://127.0.0.1:8000';

const getToken = (): string | null => localStorage.getItem('token');

// Handle token expiration - clear storage and redirect to login
const handleTokenExpired = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
  
  // Store a message to show on login page
  sessionStorage.setItem('sessionExpired', 'true');
  
  // Redirect to login (force page reload to reset React state)
  window.location.href = '/';
};

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = { ...options.headers };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  let response: Response;
  try {
    response = await fetch(`${API_URL}${url}`, { ...options, headers });
  } catch (networkError) {
    // Network error - server unreachable
    console.error('Network error:', networkError);
    throw new Error('Cannot connect to server. Is the backend running on port 8000?');
  }
  
  // Handle 401 Unauthorized (token expired or invalid)
  if (response.status === 401) {
    // Don't redirect on login/register attempts
    if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
      handleTokenExpired();
      throw new Error('Session expired. Please log in again.');
    }
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  // Handle 204 No Content (e.g., DELETE requests)
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
}

export const authAPI = {
  register: (data: UserCreate): Promise<User> => 
    fetchWithAuth('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    
  login: (data: UserLogin): Promise<AuthToken> =>
    fetchWithAuth('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    
  getMe: (): Promise<User> => fetchWithAuth('/api/auth/me'),
};

export const notesAPI = {
  upload: async (file: File, noteType: string = 'default', notebookId?: number): Promise<Note> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    let url = `${API_URL}/api/notes/upload?note_type=${noteType}`;
    if (notebookId) {
      url += `&notebook_id=${notebookId}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    // Handle 401 for file upload too
    if (response.status === 401) {
      handleTokenExpired();
      throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }
    
    return response.json();
  },
  
  getAll: (): Promise<Note[]> => fetchWithAuth('/api/notes/'),

  search: (query: string, subject?: string, topic?: string): Promise<Note[]> => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (subject) params.set('subject', subject);
    if (topic) params.set('topic', topic);
    return fetchWithAuth(`/api/notes/search?${params.toString()}`);
  },

  getCategories: (): Promise<Categories> => fetchWithAuth('/api/notes/categories'),
    
  getById: (id: number): Promise<NoteWithImage> => fetchWithAuth(`/api/notes/${id}/full`),
    
  update: (id: number, data: { structured_text?: string; title?: string; subject?: string; topic?: string; tags?: string }): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: number): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notes/${id}`, { method: 'DELETE' }),

  // AI Features
  generateFlashcards: (noteId: number, regenerate: boolean = false): Promise<FlashcardSet & { cached?: boolean }> =>
    fetchWithAuth(`/api/ai/flashcards/${noteId}?regenerate=${regenerate}`, { method: 'POST' }),

  getFlashcards: (noteId: number): Promise<FlashcardSet[]> =>
    fetchWithAuth(`/api/ai/flashcards/${noteId}`),

  summarize: (noteId: number, regenerate: boolean = false): Promise<{ summary: string; cached?: boolean }> =>
    fetchWithAuth(`/api/ai/summarize/${noteId}?regenerate=${regenerate}`, { method: 'POST' }),

  explain: (text: string, noteId?: number): Promise<{ explanation: string; highlighted_text: string; cached?: boolean }> =>
    fetchWithAuth('/api/ai/explain', { method: 'POST', body: JSON.stringify({ text, note_id: noteId }) }),

  getExplanations: (noteId: number): Promise<{ id: number; highlighted_text: string; explanation: string; created_at: string }[]> =>
    fetchWithAuth(`/api/ai/explanations/${noteId}`),
};

export const notebooksAPI = {
  create: (data: NotebookCreate): Promise<Notebook> =>
    fetchWithAuth('/api/notebooks/', { method: 'POST', body: JSON.stringify(data) }),

  getAll: (): Promise<Notebook[]> => 
    fetchWithAuth('/api/notebooks/'),

  getById: (id: number): Promise<NotebookWithNotes> => 
    fetchWithAuth(`/api/notebooks/${id}`),

  update: (id: number, data: NotebookUpdate): Promise<Notebook> =>
    fetchWithAuth(`/api/notebooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: number): Promise<void> =>
    fetchWithAuth(`/api/notebooks/${id}`, { method: 'DELETE' }),

  addNote: (notebookId: number, noteId: number): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notebooks/${notebookId}/notes`, { 
      method: 'POST', 
      body: JSON.stringify({ note_id: noteId }) 
    }),

  removeNote: (notebookId: number, noteId: number): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notebooks/${notebookId}/notes/${noteId}`, { method: 'DELETE' }),

  getAvailableNotes: (notebookId: number): Promise<Note[]> =>
    fetchWithAuth(`/api/notebooks/${notebookId}/available-notes`),
};
