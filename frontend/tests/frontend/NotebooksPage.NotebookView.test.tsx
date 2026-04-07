/**
 * Tests for NotebooksPage.tsx and NotebookView.tsx
 * Run with: npx vitest run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotebooksPage from '../../src/pages/NotebooksPage'
import NotebookView from '../../src/pages/NotebookView'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  notebooksAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    addNote: vi.fn(),
    removeNote: vi.fn(),
    getAvailableNotes: vi.fn(),
  },
  // Removed notesAPI here to fix the "declared but never read" warning
  // unless you plan to use it later in the file.
  notesAPI: {
    upload: vi.fn(),
  }
}))

// Destructure only what you use to avoid linting/TS warnings
import { notebooksAPI } from '../../src/services/api'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockNotebook = {
  id: 1,
  name: 'Biology Notes',
  color: '#1a1a2e',
  owner_id: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-01-01T00:00:00',
  note_count: 2,
}

const mockNotebookWithNotes = {
  ...mockNotebook,
  notes: [
    { 
      id: 1, 
      title: 'Mitosis', 
      status: 'completed', 
      created_at: '2024-01-01T00:00:00',
      image_filename: 'mitosis_diag.png' // Added required property
    },
    { 
      id: 2, 
      title: 'Meiosis', 
      status: 'completed', 
      created_at: '2024-01-02T00:00:00',
      image_filename: 'meiosis_diag.png' // Added required property
    },
  ]
}
// ── NotebooksPage ─────────────────────────────────────────────────────────────

describe('NotebooksPage', () => {
  const props = {
    userEmail: 'test@example.com',
    onLogout: vi.fn(),
    onOpenNotebook: vi.fn(),
    onOpenSettings: vi.fn(),
    darkMode: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', async () => {
    vi.mocked(notebooksAPI.getAll).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
    )
    render(<NotebooksPage {...props} />)
    // Loading skeletons should be visible
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('renders notebooks after loading', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([mockNotebook])
    render(<NotebooksPage {...props} />)
    await waitFor(() => {
      expect(screen.getByText('Biology Notes')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notebooks', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([])
    render(<NotebooksPage {...props} />)
    await waitFor(() => {
      expect(screen.getByText(/start your first notebook/i)).toBeInTheDocument()
    })
  })

  it('shows notebook count in header', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([mockNotebook])
    render(<NotebooksPage {...props} />)
    await waitFor(() => {
      expect(screen.getByText(/1 notebook/i)).toBeInTheDocument()
    })
  })

  it('opens create modal when New Notebook is clicked', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([])
    render(<NotebooksPage {...props} />)
    await waitFor(() => screen.getByText(/new notebook/i))
    await userEvent.click(screen.getByText(/new notebook/i))
    // FIX: Using getByRole to avoid ambiguity
    expect(screen.getByRole('heading', { name: /create notebook/i })).toBeInTheDocument()
  })

  it('shows error when notebook name is empty on create', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([])
    render(<NotebooksPage {...props} />)
    await waitFor(() => screen.getByText(/new notebook/i))
    await userEvent.click(screen.getByText(/new notebook/i))
    // FIX: Using getByRole for the button
    await userEvent.click(screen.getByRole('button', { name: /^create notebook$/i }))
    
    expect(screen.getByText(/please enter a notebook name/i)).toBeInTheDocument()
  }) // This was the line causing the syntax error previously

  it('calls notebooksAPI.create and updates list', async () => {
      vi.mocked(notebooksAPI.getAll).mockResolvedValue([]);
      vi.mocked(notebooksAPI.create).mockResolvedValue(mockNotebook);
      
      render(<NotebooksPage {...props} />);

      // 1. Wait for the trigger button and click it
      const newBtn = await screen.findByRole('button', { name: /new notebook/i });
      await userEvent.click(newBtn);

      // 2. CRITICAL: Use findByPlaceholderText to wait for the input to exist
      // If /notebook name/i still fails, try a broader /name/i to see if the text changed
      const input = await screen.findByRole('textbox');

      
      // 3. Type the value
      await userEvent.type(input, 'Biology Notes');


      // 4. Click the "Create" button inside the modal
      // Using a regex with start/end anchors to avoid matching the header
      const submitBtn = screen.getByRole('button', { name: /^create notebook$/i });
      await userEvent.click(submitBtn);

      // 5. Assert the API was called correctly
      await waitFor(() => {
        expect(notebooksAPI.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Biology Notes' })
        );
      });
    });

  it('calls onOpenNotebook when a notebook is clicked', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([mockNotebook])
    render(<NotebooksPage {...props} />)
    await waitFor(() => screen.getByText('Biology Notes'))
    await userEvent.click(screen.getByText('Biology Notes'))
    expect(props.onOpenNotebook).toHaveBeenCalledWith(1)
  })

  it('calls notebooksAPI.delete after confirmation', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([mockNotebook])
    vi.mocked(notebooksAPI.delete).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<NotebooksPage {...props} />)
    await waitFor(() => screen.getByText('Biology Notes'))

    // Hover to show action buttons
    const card = screen.getByText('Biology Notes').closest('[class*="notebook-card"]')!
    fireEvent.mouseEnter(card)

    const deleteBtn = screen.getByText('🗑️')
    await userEvent.click(deleteBtn)

    await waitFor(() => {
      expect(notebooksAPI.delete).toHaveBeenCalledWith(1)
    })
  })

  it('calls onLogout when sign out is clicked', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([])
    render(<NotebooksPage {...props} />)
    await userEvent.click(screen.getByText(/sign out/i))
    expect(props.onLogout).toHaveBeenCalled()
  })

  it('calls onOpenSettings when user avatar is clicked', async () => {
    vi.mocked(notebooksAPI.getAll).mockResolvedValue([])
    render(<NotebooksPage {...props} />)
    // User email pill contains settings icon
    await userEvent.click(screen.getByText('test@example.com'))
    expect(props.onOpenSettings).toHaveBeenCalled()
  })
})

// ── NotebookView ──────────────────────────────────────────────────────────────

describe('NotebookView', () => {
  const props = {
    notebookId: 1,
    onBack: vi.fn(),
    onOpenNote: vi.fn(),
    onCreateNote: vi.fn(),
    darkMode: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    vi.mocked(notebooksAPI.getById).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockNotebookWithNotes), 1000))
    )
    render(<NotebookView {...props} />)
    expect(screen.getByText(/loading notebook/i)).toBeInTheDocument()
  })

  it('renders notebook name after loading', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    render(<NotebookView {...props} />)
    await waitFor(() => {
      expect(screen.getByText(/biology notes/i)).toBeInTheDocument()
    })
  })

  it('renders notes list', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    render(<NotebookView {...props} />)
    await waitFor(() => {
      expect(screen.getByText('📄 Mitosis')).toBeInTheDocument()
      expect(screen.getByText('📄 Meiosis')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notes', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue({ ...mockNotebookWithNotes, notes: [] })
    render(<NotebookView {...props} />)
    await waitFor(() => {
      expect(screen.getByText(/no notes in this notebook/i)).toBeInTheDocument()
    })
  })

  it('calls onOpenNote when a note is clicked', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    render(<NotebookView {...props} />)
    await waitFor(() => screen.getByText('📄 Mitosis'))
    await userEvent.click(screen.getByText('📄 Mitosis'))
    expect(props.onOpenNote).toHaveBeenCalledWith(1, 1)
  })

  it('calls onBack when back button is clicked', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    render(<NotebookView {...props} />)
    await waitFor(() => screen.getByText('← Back'))
    await userEvent.click(screen.getByText('← Back'))
    expect(props.onBack).toHaveBeenCalled()
  })

  it('calls notebooksAPI.removeNote on remove', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    vi.mocked(notebooksAPI.removeNote).mockResolvedValue({ message: 'Note removed from notebook' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<NotebookView {...props} />)
    await waitFor(() => screen.getByText('📄 Mitosis'))

    const removeButtons = screen.getAllByText('Remove')
    await userEvent.click(removeButtons[0])

    await waitFor(() => {
      expect(notebooksAPI.removeNote).toHaveBeenCalledWith(1, 1)
    })
  })

  it('shows add existing notes modal', async () => {
    vi.mocked(notebooksAPI.getById).mockResolvedValue(mockNotebookWithNotes)
    vi.mocked(notebooksAPI.getAvailableNotes).mockResolvedValue([
      { id: 3, title: 'New Note', status: 'completed', created_at: '2024-01-03T00:00:00' } as never
    ])

    render(<NotebookView {...props} />)
    await waitFor(() => screen.getByText(/add existing/i))
    await userEvent.click(screen.getByText(/add existing/i))

    await waitFor(() => {
      expect(screen.getByText('📎 Add Existing Notes')).toBeInTheDocument()
    })
  })

  it('shows error when notebook not found', async () => {
    vi.mocked(notebooksAPI.getById).mockRejectedValue(new Error('Notebook not found'))
    render(<NotebookView {...props} />)
    await waitFor(() => {
    expect(screen.getAllByText(/notebook not found/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /notebook not found/i })).toBeInTheDocument();
  });
  })
})