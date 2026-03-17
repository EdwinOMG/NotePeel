import type { UserCreate, UserLogin, AuthToken, User, Note, NoteWithImage } from '../types';

const API_URL = 'http://127.0.0.1:8000';

const getToken = (): string | null => localStorage.getItem('token');

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = { ...options.headers };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`${API_URL}${url}`, { ...options, headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
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
  upload: async (file: File, noteType: string = 'default'): Promise<Note> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    const response = await fetch(`${API_URL}/api/notes/upload?note_type=${noteType}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }
    
    return response.json();
  },
  
  getAll: (): Promise<Note[]> => fetchWithAuth('/api/notes/'),
    
  getById: (id: number): Promise<NoteWithImage> => fetchWithAuth(`/api/notes/${id}/full`),
    
  update: (id: number, data: { structured_text?: string; title?: string }): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    
  delete: (id: number): Promise<{ message: string }> =>
    fetchWithAuth(`/api/notes/${id}`, { method: 'DELETE' }),
};
