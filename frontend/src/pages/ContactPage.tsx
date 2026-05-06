import { useState } from 'react';

interface ContactPageProps {
  userEmail?: string;
  onBack: () => void;
  darkMode: boolean;
  isMobile?: boolean;
}

export default function ContactPage({ userEmail, onBack, darkMode, isMobile = false }: ContactPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '';

  const theme = {
    bg: darkMode ? '#1a1a2e' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#252542' : '#ffffff',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
    text: darkMode ? '#e4e4e7' : '#1a1a2e',
    textSecondary: darkMode ? '#a1a1aa' : '#6b7280',
    border: darkMode ? '#3f3f5a' : '#e5e7eb',
    inputBg: darkMode ? '#1a1a2e' : '#ffffff',
  };

  const handleSubmit = async () => {
    if (!email.trim() || !message.trim()) return;

    if (!WEB3FORMS_ACCESS_KEY) {
      setError('Contact form is not configured yet. Please email us directly.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: name || 'Not provided',
          email,
          subject: `[NotePeel] ${subject}`,
          message,
          from_name: 'NotePeel Contact Form',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError('Failed to send message. Please try emailing us directly.');
      }
    } catch (err) {
      setError('Failed to send message. Please try emailing us directly.');
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: `1.5px solid ${theme.border}`,
    borderRadius: '10px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    background: theme.inputBg,
    color: theme.text,
    fontFamily: "'Inter', sans-serif",
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <header style={{
        background: theme.headerBg,
        borderBottom: darkMode ? `1px solid ${theme.border}` : '1px solid #F9A825',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(255, 193, 7, 0.3)',
        paddingTop: isMobile ? 'max(0px, env(safe-area-inset-top))' : undefined,
      }}>
        <div style={{
          maxWidth: '800px', margin: '0 auto',
          padding: isMobile ? '16px 20px' : '14px 32px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <button onClick={onBack} style={{
            padding: '8px 16px',
            background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            color: darkMode ? '#e4e4e7' : '#5D4037', fontSize: '14px', fontWeight: 500,
          }}>
            ← Back
          </button>
          <h1 style={{
            margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: 700,
            color: darkMode ? '#e4e4e7' : '#5D4037',
            fontFamily: "'Playfair Display', Georgia, serif",
          }}>
            Contact Us
          </h1>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '600px', margin: '0 auto',
        padding: isMobile ? '24px 16px' : '40px 32px',
      }}>
        {submitted ? (
          <div style={{
            background: theme.cardBg, borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            padding: isMobile ? '40px 24px' : '60px 40px',
            textAlign: 'center',
            animation: 'fadeIn 0.4s ease-out',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🐵</div>
            <h2 style={{
              margin: '0 0 10px', fontSize: '22px', fontWeight: 700, color: theme.text,
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>
              Message Sent!
            </h2>
            <p style={{
              margin: '0 0 24px', fontSize: '14px', color: theme.textSecondary, lineHeight: 1.6,
            }}>
              Thanks for reaching out. We'll get back to you as soon as possible, usually within 1-2 business days.
            </p>
            <button onClick={onBack} style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
              color: '#5D4037', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>
              Go Back
            </button>
          </div>
        ) : (
          <>
            {/* Info card */}
            <div style={{
              background: theme.cardBg, borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: isMobile ? '20px' : '28px',
              marginBottom: '20px',
            }}>
              <p style={{ margin: '0 0 14px', fontSize: '14px', color: theme.textSecondary, lineHeight: 1.6 }}>
                Have a question, found a bug, or need help with your account? We're here to help.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: theme.textSecondary }}>
                  📧 Email us at{' '}
                  <a
                    href="mailto:therainforestrains@gmail.com"
                    style={{ color: theme.text, fontWeight: 600, textDecoration: 'none' }}
                  >
                    therainforestrains@gmail.com
                  </a>
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: theme.textSecondary }}>
                  📞 Call or text{' '}
                  <a
                    href="tel:845-807-7130"
                    style={{ color: theme.text, fontWeight: 600, textDecoration: 'none' }}
                  >
                    (845) 807-7130
                  </a>
                </p>
              </div>
            </div>

            {/* Form */}
            <div style={{
              background: theme.cardBg, borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              padding: isMobile ? '24px 20px' : '32px',
            }}>
              {/* Name */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: theme.text }}>
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#FFC107'}
                  onBlur={(e) => e.currentTarget.style.borderColor = theme.border}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: theme.text }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#FFC107'}
                  onBlur={(e) => e.currentTarget.style.borderColor = theme.border}
                />
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: theme.text }}>
                  Topic
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '36px',
                  }}
                >
                  <option value="general">General Question</option>
                  <option value="bug">Bug Report</option>
                  <option value="billing">Billing & Subscriptions</option>
                  <option value="account">Account & Data</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Message */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: theme.text }}>
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us how we can help..."
                  rows={5}
                  required
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: '120px',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#FFC107'}
                  onBlur={(e) => e.currentTarget.style.borderColor = theme.border}
                />
              </div>

              {/* Error message */}
              {error && (
                <p style={{
                  margin: '0 0 16px', fontSize: '13px', color: '#ef4444',
                  background: darkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                  padding: '10px 14px', borderRadius: '8px',
                }}>
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!email.trim() || !message.trim() || sending}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: (!email.trim() || !message.trim() || sending)
                    ? (darkMode ? '#3f3f5a' : '#e5e7eb')
                    : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                  color: (!email.trim() || !message.trim() || sending)
                    ? theme.textSecondary
                    : '#5D4037',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: (!email.trim() || !message.trim() || sending) ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (email.trim() && message.trim() && !sending) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,152,0,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
