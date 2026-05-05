/**
 * Tests for src/services/api.ts
 * Run with: npx vitest run
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authAPI, notesAPI, notebooksAPI } from '../../src/services/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockFetch = (data: unknown, status = 200) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

const mockFetchError = (status: number, detail = 'Request failed') => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  } as Response)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── authAPI ───────────────────────────────────────────────────────────────────

describe('authAPI.login', () => {
  it('returns access token on success', async () => {
    mockFetch({ access_token: 'abc123', token_type: 'bearer' })
    const result = await authAPI.login({ email: 'test@example.com', password: 'password' })
    expect(result.access_token).toBe('abc123')
  })

  it('throws on invalid credentials', async () => {
    mockFetchError(401, 'Incorrect email or password')
    await expect(authAPI.login({ email: 'bad@example.com', password: 'wrong' }))
      .rejects.toThrow('Incorrect email or password')
  })

  it('sends correct body', async () => {
    mockFetch({ access_token: 'tok', token_type: 'bearer' })
    await authAPI.login({ email: 'user@example.com', password: 'pass' })
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.email).toBe('user@example.com')
    expect(body.password).toBe('pass')
  })
})

describe('authAPI.register', () => {
  it('returns user on success', async () => {
    const user = { id: 1, email: 'new@example.com', username: 'newuser' }
    mockFetch(user)
    const result = await authAPI.register({ email: 'new@example.com', username: 'newuser', password: 'pass' })
    expect(result.email).toBe('new@example.com')
  })

  it('throws on duplicate email', async () => {
    mockFetchError(400, 'Email already registered')
    await expect(authAPI.register({ email: 'dup@example.com', username: 'user', password: 'pass' }))
      .rejects.toThrow('Email already registered')
  })
})

describe('authAPI.getMe', () => {
  it('returns user when token is valid', async () => {
    localStorage.setItem('token', 'valid-token')
    const user = { id: 1, email: 'me@example.com', username: 'me' }
    mockFetch(user)
    const result = await authAPI.getMe()
    expect(result.email).toBe('me@example.com')
  })

  it('includes Authorization header', async () => {
    localStorage.setItem('token', 'my-token')
    mockFetch({ id: 1, email: 'me@example.com' })
    await authAPI.getMe()
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].headers['Authorization']).toBe('Bearer my-token')
  })
})

describe('authAPI.googleLogin', () => {
  it('returns access token on success', async () => {
    mockFetch({ access_token: 'google-token', token_type: 'bearer' })
    const result = await authAPI.googleLogin('google-credential')
    expect(result.access_token).toBe('google-token')
  })
})

// ── Token Expiry Handling ─────────────────────────────────────────────────────

describe('fetchWithAuth token expiry', () => {
  it('clears token and sets sessionExpired flag on 401', async () => {
    localStorage.setItem('token', 'expired-token')
    // Mock window.location.href setter
    delete (window as unknown as { location: unknown }).location
    ;(window as unknown as { location: { href: string } }).location = { href: '/' }

    mockFetchError(401, 'Token has expired')

    // Any authenticated call should trigger the expiry logic
    try {
      await notesAPI.getAll()
    } catch {
      // expected
    }

    expect(localStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('sessionExpired')).toBe('true')
  })

  it('does NOT redirect on 401 for login endpoint', async () => {
    localStorage.setItem('token', 'some-token')
    mockFetchError(401, 'Incorrect email or password')

    await expect(authAPI.login({ email: 'x@x.com', password: 'wrong' }))
      .rejects.toThrow()

    // Token should still be there (we don't expire on auth endpoint 401s)
    expect(localStorage.getItem('token')).toBe('some-token')
  })
})

// ── notesAPI ──────────────────────────────────────────────────────────────────

describe('notesAPI.getAll', () => {
  it('returns array of notes', async () => {
    const notes = [{ id: 1, title: 'Note 1' }, { id: 2, title: 'Note 2' }]
    mockFetch(notes)
    const result = await notesAPI.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })
})

describe('notesAPI.getById', () => {
  it('fetches note by id from correct endpoint', async () => {
    const note = { id: 5, title: 'My Note', raw_text: 'content' }
    mockFetch(note)
    const result = await notesAPI.getById(5)
    expect(result.id).toBe(5)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('/api/notes/5/full')
  })
})

describe('notesAPI.update', () => {
  it('sends PUT with correct body', async () => {
    mockFetch({ message: 'Updated' })
    await notesAPI.update(1, { title: 'New Title', tags: 'exam' })
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('PUT')
    const body = JSON.parse(call[1].body)
    expect(body.title).toBe('New Title')
    expect(body.tags).toBe('exam')
  })
})

describe('notesAPI.delete', () => {
  it('sends DELETE to correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
    } as Response)
    await notesAPI.delete(3)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('DELETE')
    expect(call[0]).toContain('/api/notes/3')
  })
})

describe('notesAPI.search', () => {
  it('includes query param in URL', async () => {
    mockFetch([])
    await notesAPI.search('biology')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('q=biology')
  })

  it('includes subject and topic when provided', async () => {
    mockFetch([])
    await notesAPI.search('mitosis', 'Biology', 'Cell Division')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('subject=Biology')
    expect(call[0]).toContain('topic=Cell+Division')
  })
})

describe('notesAPI.generateFlashcards', () => {
  it('sends POST to flashcards endpoint', async () => {
    const result = { title: 'Flashcards: Bio', cards: [{ question: 'Q', answer: 'A' }], cached: false }
    mockFetch(result)
    const res = await notesAPI.generateFlashcards(1)
    expect(res.cards).toHaveLength(1)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('POST')
    expect(call[0]).toContain('/api/ai/flashcards/1')
  })

  it('includes regenerate param', async () => {
    mockFetch({ title: 'Flashcards', cards: [], cached: false })
    await notesAPI.generateFlashcards(1, true)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('regenerate=true')
  })
})

describe('notesAPI.summarize', () => {
  it('sends POST to summarize endpoint', async () => {
    mockFetch({ summary: 'Summary text', cached: false })
    const result = await notesAPI.summarize(2)
    expect(result.summary).toBe('Summary text')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('/api/ai/summarize/2')
  })
})

describe('notesAPI.explain', () => {
  it('sends POST with text and note_id', async () => {
    mockFetch({ explanation: 'Explanation text', highlighted_text: 'mitosis', cached: false })
    const result = await notesAPI.explain('mitosis', 5)
    expect(result.explanation).toBe('Explanation text')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.text).toBe('mitosis')
    expect(body.note_id).toBe(5)
  })

  it('works without note_id', async () => {
    mockFetch({ explanation: 'Explanation', highlighted_text: 'term', cached: false })
    await notesAPI.explain('term')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.note_id).toBeUndefined()
  })
})

// ── notebooksAPI ──────────────────────────────────────────────────────────────

describe('notebooksAPI.create', () => {
  it('sends POST with name and color', async () => {
    const nb = { id: 1, name: 'Physics', color: '#533483', note_count: 0 }
    mockFetch(nb)
    const result = await notebooksAPI.create({ name: 'Physics', color: '#533483' })
    expect(result.name).toBe('Physics')
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('POST')
  })
})

describe('notebooksAPI.delete', () => {
  it('sends DELETE to correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
    } as Response)
    await notebooksAPI.delete(4)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('DELETE')
    expect(call[0]).toContain('/api/notebooks/4')
  })
})

describe('notebooksAPI.addNote', () => {
  it('sends POST with note_id in body', async () => {
    mockFetch({ message: 'Note added to notebook' })
    await notebooksAPI.addNote(1, 5)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(call[1].body)
    expect(body.note_id).toBe(5)
  })
})

describe('notebooksAPI.removeNote', () => {
  it('sends DELETE to correct endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
    } as Response)
    await notebooksAPI.removeNote(1, 5)
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].method).toBe('DELETE')
    expect(call[0]).toContain('/api/notebooks/1/notes/5')
  })
})