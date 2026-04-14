/**
 * Tests for Login.tsx and Register.tsx
 * Run with: npx vitest run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../../src/pages/Login'
import Register from '../../src/pages/Register'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    googleLogin: vi.fn(),
  }
}))

import { authAPI } from '../../src/services/api'

// ── Login Tests ───────────────────────────────────────────────────────────────

describe('Login', () => {
  const onLogin = vi.fn()
  const onSwitchToRegister = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const renderLogin = () =>
    render(<Login onLogin={onLogin} onSwitchToRegister={onSwitchToRegister} />)

  it('renders email and password inputs', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('renders the sign in button', () => {
    renderLogin()
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('renders link to switch to register', () => {
    renderLogin()
    expect(screen.getByText(/sign up/i)).toBeInTheDocument()
  })

  it('calls onSwitchToRegister when Sign Up is clicked', async () => {
    renderLogin()
    await userEvent.click(screen.getByText(/sign up/i))
    expect(onSwitchToRegister).toHaveBeenCalled()
  })

  it('shows error when submitting empty form', async () => {
    renderLogin()
    await userEvent.click(screen.getByText(/sign in/i))
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
    })
  })

  it('shows error when only email is filled', async () => {
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.click(screen.getByText(/sign in/i))
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
    })
  })

  it('calls authAPI.login with email and password', async () => {
    vi.mocked(authAPI.login).mockResolvedValue({ access_token: 'tok', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    await userEvent.click(screen.getByText(/sign in/i))

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('calls onLogin with token and email on success', async () => {
    vi.mocked(authAPI.login).mockResolvedValue({ access_token: 'tok123', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    await userEvent.click(screen.getByText(/sign in/i))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('tok123', 'test@example.com')
    })
  })

  it('shows error message on failed login', async () => {
    vi.mocked(authAPI.login).mockRejectedValue(new Error('Incorrect email or password'))
    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'bad@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrongpass')
    await userEvent.click(screen.getByText(/sign in/i))

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('disables button while loading', async () => {
    vi.mocked(authAPI.login).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ access_token: 'tok', token_type: 'bearer' }), 500))
    )
    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass')

    const button = screen.getByRole('button', { name: /sign in/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
  })

  it('shows session expired message from sessionStorage', () => {
    sessionStorage.setItem('sessionExpired', 'true')
    renderLogin()
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('sessionExpired')).toBeNull()
  })

  it('submits on Enter key press in password field', async () => {
    vi.mocked(authAPI.login).mockResolvedValue({ access_token: 'tok', token_type: 'bearer' })
    renderLogin()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123{Enter}')

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalled()
    })
  })
})

// ── Register Tests ─────────────────────────────────────────────────────────────

describe('Register', () => {
  const onRegister = vi.fn()
  const onSwitchToLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderRegister = () =>
    render(<Register onRegister={onRegister} onSwitchToLogin={onSwitchToLogin} />)

  it('renders email, username, and password inputs', () => {
    renderRegister()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('renders create account button', () => {
    renderRegister()
    expect(screen.getByText(/create account/i)).toBeInTheDocument()
  })

  it('calls onSwitchToLogin when Sign In link is clicked', async () => {
    renderRegister()
    await userEvent.click(screen.getByText(/sign in/i))
    expect(onSwitchToLogin).toHaveBeenCalled()
  })

  it('shows error when fields are empty', async () => {
    renderRegister()
    await userEvent.click(screen.getByText(/create account/i))
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
    })
  })

  it('shows error when only email is filled', async () => {
    renderRegister()
    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.click(screen.getByText(/create account/i))
    await waitFor(() => {
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument()
    })
  })

  it('calls authAPI.register and then authAPI.login on success', async () => {
    vi.mocked(authAPI.register).mockResolvedValue({
      id: 1, email: 'new@example.com', username: 'newuser'
    } as never)
    vi.mocked(authAPI.login).mockResolvedValue({ access_token: 'tok', token_type: 'bearer' })
    renderRegister()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await userEvent.type(screen.getByPlaceholderText('Username'), 'newuser')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    await userEvent.click(screen.getByText(/create account/i))

    await waitFor(() => {
      expect(authAPI.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
      })
      expect(authAPI.login).toHaveBeenCalled()
    })
  })

  it('calls onRegister with token and email on success', async () => {
    vi.mocked(authAPI.register).mockResolvedValue({
      id: 1, email: 'new@example.com', username: 'newuser'
    } as never)
    vi.mocked(authAPI.login).mockResolvedValue({ access_token: 'reg-token', token_type: 'bearer' })
    renderRegister()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'new@example.com')
    await userEvent.type(screen.getByPlaceholderText('Username'), 'newuser')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    await userEvent.click(screen.getByText(/create account/i))

    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith('reg-token', 'new@example.com')
    })
  })

  it('shows error on duplicate email', async () => {
    vi.mocked(authAPI.register).mockRejectedValue(new Error('Email already registered'))
    renderRegister()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'dup@example.com')
    await userEvent.type(screen.getByPlaceholderText('Username'), 'dupuser')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass')
    await userEvent.click(screen.getByText(/create account/i))

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    })
  })

  it('disables button during loading', async () => {
    vi.mocked(authAPI.register).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ id: 1, email: 'e@e.com', username: 'u' } as never), 500))
    )
    renderRegister()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Username'), 'testuser')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass')
    fireEvent.click(screen.getByText(/create account/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
    })
  })
})