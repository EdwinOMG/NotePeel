interface PrivacyPolicyPageProps {
  onBack: () => void;
  darkMode: boolean;
  isMobile?: boolean;
}

export default function PrivacyPolicyPage({ onBack, darkMode, isMobile = false }: PrivacyPolicyPageProps) {
  const theme = {
    bg: darkMode ? '#1a1a2e' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#252542' : '#ffffff',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
    text: darkMode ? '#e4e4e7' : '#1a1a2e',
    textSecondary: darkMode ? '#a1a1aa' : '#6b7280',
    border: darkMode ? '#3f3f5a' : '#e5e7eb',
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{
        margin: '0 0 10px',
        fontSize: '17px',
        fontWeight: 700,
        color: theme.text,
      }}>
        {title}
      </h3>
      <div style={{
        fontSize: '14px',
        color: theme.textSecondary,
        lineHeight: 1.7,
      }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
      `}</style>

      {/* Header */}
      <header style={{
        background: theme.headerBg,
        borderBottom: darkMode ? `1px solid ${theme.border}` : '1px solid #F9A825',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(255, 193, 7, 0.3)',
        paddingTop: isMobile ? 'max(0px, env(safe-area-inset-top))' : undefined,
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: isMobile ? '16px 20px' : '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px',
              background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: darkMode ? '#e4e4e7' : '#5D4037',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            ← Back
          </button>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '18px' : '22px',
            fontWeight: 700,
            color: darkMode ? '#e4e4e7' : '#5D4037',
            fontFamily: "'Playfair Display', Georgia, serif",
          }}>
            Privacy Policy
          </h1>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: isMobile ? '24px 16px' : '40px 32px',
      }}>
        <div style={{
          background: theme.cardBg,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          padding: isMobile ? '24px 20px' : '36px',
        }}>
          <p style={{
            fontSize: '13px',
            color: theme.textSecondary,
            margin: '0 0 24px',
            fontStyle: 'italic',
          }}>
            Last updated: April 2026
          </p>

          <Section title="1. Introduction">
            <p style={{ margin: 0 }}>
              NotePeel ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our
              note-taking and AI transcription service, including our website, mobile app, and any related
              services (collectively, the "Service").
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: theme.text }}>Account Information:</strong> When you sign in with Google or
              Microsoft, we receive your email address, display name, and profile picture from the identity provider. We
              do not receive or store your passwords.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: theme.text }}>Uploaded Content:</strong> We store images of handwritten
              notes that you upload for processing. Processed text, summaries, explanations, and flashcards
              generated from your notes are also stored.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: theme.text }}>Usage Data:</strong> We track daily AI request counts and
              token usage to enforce plan limits. We may also collect basic analytics such as device type and
              feature usage frequency.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: theme.text }}>Payment Information:</strong> Payment processing is handled
              entirely by Stripe. We do not collect, store, or have access to your credit card numbers or
              banking details. Stripe may share with us your billing email and subscription status.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p style={{ margin: 0 }}>
              We use your information to provide, maintain, and improve the Service, including AI-powered
              transcription and note organization. We use your email to communicate important account
              information. Usage data helps us enforce plan limits and improve performance. We do not sell,
              rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p style={{ margin: 0 }}>
              We use third-party services to operate NotePeel, including Google Cloud and Cloudflare for AI
              processing, Cloudflare R2 for file storage, Stripe for payment processing, and Google/Microsoft
              for authentication. Each of these services has its own privacy policy governing how they handle
              your data. We only share the minimum data necessary for each service to function.
            </p>
          </Section>

          <Section title="5. Data Storage and Security">
            <p style={{ margin: 0 }}>
              Your data is stored on secure servers. We use encryption in transit (HTTPS/TLS) and implement
              reasonable security measures to protect your information. However, no method of electronic
              storage or transmission over the Internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p style={{ margin: 0 }}>
              We retain your data for as long as your account is active. You may delete individual notes or
              notebooks at any time. If you wish to delete your account entirely, please contact us and we
              will remove all associated data within 30 days.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p style={{ margin: 0 }}>
              Depending on your jurisdiction, you may have the right to access, correct, or delete your
              personal data, object to or restrict certain processing, request data portability, and withdraw
              consent where processing is based on consent. To exercise these rights, please contact us using
              the information below.
            </p>
          </Section>

          <Section title="8. Children's Privacy">
            <p style={{ margin: 0 }}>
              NotePeel is not intended for children under the age of 13. We do not knowingly collect personal
              information from children under 13. If we discover that a child under 13 has provided us with
              personal information, we will promptly delete it.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p style={{ margin: 0 }}>
              We may update this Privacy Policy from time to time. We will notify you of any material changes
              by updating the "Last updated" date at the top and, where appropriate, by email. Your continued
              use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p style={{ margin: 0 }}>
              If you have questions or concerns about this Privacy Policy or our data practices, please
              contact us at <strong style={{ color: theme.text }}>therainforestrains@gmail.com</strong> or
              call <strong style={{ color: theme.text }}>(845) 807-7130</strong>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
