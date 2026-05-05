interface TermsPageProps {
  onBack: () => void;
  darkMode: boolean;
  isMobile?: boolean;
}

export default function TermsPage({ onBack, darkMode, isMobile = false }: TermsPageProps) {
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
      <h3 style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 700, color: theme.text }}>
        {title}
      </h3>
      <div style={{ fontSize: '14px', color: theme.textSecondary, lineHeight: 1.7 }}>
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
            Terms of Service
          </h1>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '800px', margin: '0 auto',
        padding: isMobile ? '24px 16px' : '40px 32px',
      }}>
        <div style={{
          background: theme.cardBg, borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          padding: isMobile ? '24px 20px' : '36px',
        }}>
          <p style={{ fontSize: '13px', color: theme.textSecondary, margin: '0 0 24px', fontStyle: 'italic' }}>
            Last updated: April 2026
          </p>

          <Section title="1. Acceptance of Terms">
            <p style={{ margin: 0 }}>
              By accessing or using NotePeel (the "Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree, do not use the Service. We may update these Terms from time to
              time, and your continued use constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p style={{ margin: 0 }}>
              NotePeel is an AI-powered note transcription and organization service. Users can upload images
              of handwritten notes, which are processed using artificial intelligence to produce digital text,
              summaries, explanations, and flashcards. The Service is provided on a free tier with daily usage
              limits and a paid Pro tier with expanded limits and features.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p style={{ margin: 0 }}>
              You must sign in with a valid Google or Microsoft account to use the Service. You are responsible
              for maintaining the security of your account credentials. You must not share your account with
              others. You agree to provide accurate information and to notify us promptly of any unauthorized
              access.
            </p>
          </Section>

          <Section title="4. User Content">
            <p style={{ margin: '0 0 10px' }}>
              You retain ownership of any content you upload to NotePeel, including images and notes ("User
              Content"). By uploading User Content, you grant us a limited, non-exclusive license to process,
              store, and display your content solely for the purpose of providing the Service to you.
            </p>
            <p style={{ margin: 0 }}>
              You represent that you have the right to upload any content you submit and that your content does
              not violate any third-party rights. You agree not to upload content that is illegal, harmful,
              threatening, abusive, harassing, defamatory, or otherwise objectionable.
            </p>
          </Section>

          <Section title="5. AI-Generated Content">
            <p style={{ margin: 0 }}>
              The Service uses artificial intelligence to transcribe and analyze your notes. AI-generated
              output (transcriptions, summaries, explanations, flashcards) is provided "as is" and may contain
              errors or inaccuracies. You are responsible for reviewing and verifying any AI-generated content.
              NotePeel does not guarantee the accuracy, completeness, or reliability of AI-generated output.
            </p>
          </Section>

          <Section title="6. Subscriptions and Payments">
            <p style={{ margin: '0 0 10px' }}>
              The Pro subscription is billed monthly via Stripe. By subscribing, you authorize us to charge
              your payment method on a recurring basis until you cancel. You may cancel at any time, and you
              will retain access to Pro features until the end of your current billing period.
            </p>
            <p style={{ margin: 0 }}>
              We reserve the right to change pricing with at least 30 days' notice. Price changes will apply
              at the start of your next billing period after notice is given. Refunds are handled on a
              case-by-case basis — please contact us if you believe you are entitled to a refund.
            </p>
          </Section>

          <Section title="7. Usage Limits">
            <p style={{ margin: 0 }}>
              The free tier is subject to daily AI request limits and token budgets, which may be adjusted at
              our discretion. The Pro tier provides significantly higher limits. Exceeding limits on the free
              tier will temporarily restrict AI features until the next daily reset at midnight UTC. Abuse or
              manipulation of usage limits may result in account suspension.
            </p>
          </Section>

          <Section title="8. Prohibited Uses">
            <p style={{ margin: 0 }}>
              You agree not to use the Service to violate any laws or regulations, infringe on intellectual
              property rights, attempt to gain unauthorized access to our systems, interfere with the proper
              functioning of the Service, use automated systems or bots to access the Service beyond normal
              usage, or resell access to the Service without our written consent.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p style={{ margin: 0 }}>
              To the maximum extent permitted by law, NotePeel shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
              whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible
              losses resulting from your access to or use of (or inability to use) the Service. Our total
              aggregate liability shall not exceed the greater of $50 or the amounts paid by you to us in the
              12 months preceding the claim.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p style={{ margin: 0 }}>
              The Service is provided "as is" and "as available" without warranties of any kind, whether
              express or implied, including implied warranties of merchantability, fitness for a particular
              purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, secure,
              or error-free, or that AI-generated results will be accurate.
            </p>
          </Section>

          <Section title="11. Indemnification">
            <p style={{ margin: 0 }}>
              You agree to indemnify and hold harmless NotePeel and its officers, directors, employees, and
              agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees)
              arising from your use of the Service, your User Content, or your violation of these Terms.
            </p>
          </Section>

          <Section title="12. Termination">
            <p style={{ margin: 0 }}>
              We reserve the right to suspend or terminate your account at any time, with or without cause,
              and with or without notice. Upon termination, your right to use the Service will immediately
              cease. Provisions of these Terms that by their nature should survive termination shall survive,
              including ownership, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p style={{ margin: 0 }}>
              These Terms shall be governed by and construed in accordance with the laws of the United States,
              without regard to conflict of law principles. Any dispute arising from these Terms or the
              Service shall be resolved through binding arbitration, except where prohibited by law.
            </p>
          </Section>

          <Section title="14. Contact Us">
            <p style={{ margin: 0 }}>
              If you have questions about these Terms, please contact us at{' '}
              <strong style={{ color: theme.text }}>therainforestrains@gmail.com</strong> or call{' '}
              <strong style={{ color: theme.text }}>(845) 807-7130</strong>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
