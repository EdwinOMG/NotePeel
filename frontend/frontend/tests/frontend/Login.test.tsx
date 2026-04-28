/**
 * Tests for Login.tsx (Google + Microsoft OAuth)
 * Run with: npx vitest run tests/frontend/Login.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Login from '../../src/pages/Login'

// Mock the API
vi.mock('../../src/services/api', () => ({
  authAPI: {
    googleLogin: vi.fn(),
    microsoftLogin: vi.fn(),
    getMe: vi.fn(),
  },
}))

describe('Login', () => {
  const onLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the NotePeel branding', () => {
    render(<Login onLogin={onLogin} />)
    expect(screen.getByText('NotePeel')).toBeInTheDocument()
    expect(screen.getByText('Peel back the layers of your notes')).toBeInTheDocument()
  })

  it('renders the NotePeel logo', () => {
    render(<Login onLogin={onLogin} />)
    const logo = screen.getByAltText('NotePeel')
    expect(logo).toBeInTheDocument()
  })

  it('does not render email or password inputs', () => {
    render(<Login onLogin={onLogin} />)
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument()
  })

  it('shows config error when no providers are set', () => {
    render(<Login onLogin={onLogin} />)
    expect(screen.getByText(/No sign-in providers are configured/i)).toBeInTheDocument()
  })

  it('shows session expired message when flag is set', () => {
    sessionStorage.setItem('sessionExpired', 'true')
    render(<Login onLogin={onLogin} />)
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('sessionExpired')).toBeNull()
  })
})
