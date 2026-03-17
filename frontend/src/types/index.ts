// User types
export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// Note types
export interface Note {
  id: number;
  title: string;
  image_filename: string;
  status: string;
  created_at: string;
  subject?: string;
  topic?: string;
}

export interface NoteWithImage extends Note {
  image_base64: string;
  image_mimetype: string;
  raw_text: string;
  structured_text: string;
}
