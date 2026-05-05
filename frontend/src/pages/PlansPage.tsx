import { useState } from 'react';
import { useUsage } from '../hooks/useUsage';
import { stripeAPI } from '../services/api';

interface PlansPageProps {
  userEmail: string;
  onBack: () => void;
  darkMode: boolean;
  isMobile?: boolean;
}

// ── These must match the Price IDs from your Stripe Dashboard ──
const PRICE_IDS = {
  pro_monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || '',
  pro_annual: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID || '',
  premium_monthly: import.meta.env.VITE_STRIPE_PREMIUM_MONTHLY_PRICE_ID || '',
  premium_annual: import.meta.env.VITE_STRIPE_PREMIUM_ANNUAL_PRICE_ID || '',
};

export default function PlansPage({ userEmail, onBack, darkMode, isMobile = false }: PlansPageProps) {
  const { usage } = useUsage(localStorage.getItem('token'));
  const currentPlan = usage?.plan || 'free';
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const theme = {
    bg: darkMode ? '#1a1a2e' : 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
    cardBg: darkMode ? '#252542' : '#ffffff',
    headerBg: darkMode ? '#2d2d4a' : 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)',
    text: darkMode ? '#e4e4e7' : '#1a1a2e',
    textSecondary: darkMode ? '#a1a1aa' : '#6b7280',
    border: darkMode ? '#3f3f5a' : '#e5e7eb',
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Get started with the basics',
      features: [
        { text: '4 AI requests/day (shared budget)', included: true },
        { text: 'OCR scanning (from shared budget)', included: true },
        { text: 'Summarize & explain', included: true },
        { text: 'Unlimited notebooks', included: true },
        { text: 'Flashcard generation', included: false },
        { text: 'Study chatbot', included: false },
      ],
      stripePriceId: null,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: billingPeriod === 'monthly' ? '$5' : '$50',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'More power for serious students',
      features: [
        { text: '300 AI requests/month (100/day)', included: true },
        { text: '100 OCR scans/month (separate)', included: true },
        { text: 'Summarize & explain', included: true },
        { text: 'Unlimited notebooks', included: true },
        { text: 'Flashcard generation', included: true },
        { text: 'Study chatbot', included: false },
      ],
      stripePriceId: billingPeriod === 'monthly' ? PRICE_IDS.pro_monthly : PRICE_IDS.pro_annual,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: billingPeriod === 'monthly' ? '$10' : '$100',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'Everything, unlimited OCR, AI chat',
      features: [
        { text: '1,000 AI requests/month (150/day)', included: true },
        { text: 'Unlimited OCR scans', included: true },
        { text: 'Summarize & explain', included: true },
        { text: 'Unlimited notebooks', included: true },
        { text: 'Flashcard generation', included: true },
        { text: 'Study chatbot', included: true },
      ],
      stripePriceId: billingPeriod === 'monthly' ? PRICE_IDS.premium_monthly : PRICE_IDS.premium_annual,
    },
  ];

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    if (plan.id === currentPlan) return;

    if (plan.id === 'free') {
      try {
        setLoading('free');
        await stripeAPI.cancelSubscription();
        alert('Your subscription will cancel at the end of the current billing period.');
      } catch (err) {
        alert('Failed to cancel. Please try again or contact support.');
      } finally {
        setLoading(null);
      }
      return;
    }

    if (!plan.stripePriceId) {
      alert('Price not configured. Please set the Stripe Price IDs in your environment variables.');
      return;
    }

    try {
      setLoading(plan.id);
      const { checkout_url } = await stripeAPI.createCheckout(plan.stripePriceId);
      window.location.href = checkout_url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert(`Failed to start checkout: ${err?.message || 'Unknown error'}. Please try again.`);
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading('manage');
      const { portal_url } = await stripeAPI.createPortal();
      window.location.href = portal_url;
    } catch (err) {
      alert('Failed to open billing portal. Please try again.');
      setLoading(null);
    }
  };

  const planTierOrder = ['free', 'pro', 'premium'];
  const currentTierIndex = planTierOrder.indexOf(currentPlan);

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .plan-card { animation: fadeIn 0.4s ease-out both; }
        .plan-card:nth-child(2) { animation-delay: 0.08s; }
        .plan-card:nth-child(3) { animation-delay: 0.16s; }
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
          maxWidth: '1100px', margin: '0 auto',
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
          <img src="/monkey-loading.png" alt="NotePeel" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <h1 style={{
            margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 700,
            color: darkMode ? '#e4e4e7' : '#5D4037',
            fontFamily: "'Playfair Display', Georgia, serif",
          }}>
            Plans
          </h1>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: '1000px', margin: '0 auto',
        padding: isMobile ? '24px 16px' : '48px 32px',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '36px' }}>
          <h2 style={{
            margin: '0 0 8px', fontSize: isMobile ? '24px' : '32px', fontWeight: 800,
            color: theme.text, fontFamily: "'Playfair Display', Georgia, serif",
          }}>
            Choose your plan
          </h2>
          <p style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', color: theme.textSecondary }}>
            Unlock the full power of AI-powered note transcription
          </p>

          {/* Billing Period Toggle */}
          <div style={{
            display: 'flex', justifyContent: 'center', marginTop: '20px',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: darkMode ? '#2d2d4a' : '#e8e0f0',
              borderRadius: '30px', padding: '4px',
            }}>
              <button
                onClick={() => setBillingPeriod('monthly')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '26px', border: 'none',
                  fontSize: '15px', fontWeight: 600,
                  cursor: 'pointer',
                  background: billingPeriod === 'monthly'
                    ? (darkMode ? '#6C3FD1' : '#6C3FD1')
                    : 'transparent',
                  color: billingPeriod === 'monthly'
                    ? '#fff'
                    : (darkMode ? '#a1a1aa' : '#555'),
                  transition: 'all 0.2s ease',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '26px', border: 'none',
                  fontSize: '15px', fontWeight: 600,
                  cursor: 'pointer',
                  background: billingPeriod === 'annual'
                    ? (darkMode ? '#6C3FD1' : '#6C3FD1')
                    : 'transparent',
                  color: billingPeriod === 'annual'
                    ? '#fff'
                    : (darkMode ? '#a1a1aa' : '#555'),
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                Annual
                <span style={{
                  background: '#16a34a', color: '#fff',
                  padding: '2px 8px', borderRadius: '12px',
                  fontSize: '11px', fontWeight: 700,
                }}>
                  Save ~17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plan Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '16px' : '20px',
        }}>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const planIndex = planTierOrder.indexOf(plan.id);
            const isUpgrade = planIndex > currentTierIndex;
            const isPremium = plan.id === 'premium';
            const isPopular = plan.id === 'pro';

            return (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  background: theme.cardBg,
                  borderRadius: '20px',
                  border: isPremium
                    ? '2px solid #7C4DFF'
                    : isPopular
                      ? '2px solid #FFB300'
                      : `1px solid ${theme.border}`,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: isPremium
                    ? '0 8px 30px rgba(124, 77, 255, 0.15)'
                    : isPopular
                      ? '0 8px 30px rgba(255, 152, 0, 0.15)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Badge */}
                {isPopular && (
                  <div style={{
                    background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                    color: '#5D4037', textAlign: 'center', padding: '6px',
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}>
                    Most Popular
                  </div>
                )}
                {isPremium && (
                  <div style={{
                    background: 'linear-gradient(135deg, #7C4DFF 0%, #651FFF 100%)',
                    color: '#fff', textAlign: 'center', padding: '6px',
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}>
                    Best Value
                  </div>
                )}

                <div style={{ padding: isMobile ? '24px 20px' : '28px 24px' }}>
                  {/* Plan header */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: theme.text }}>
                        {plan.name}
                      </h3>
                      {isCurrent && (
                        <span style={{
                          background: darkMode ? '#1a2e1a' : '#e8f5e9',
                          color: darkMode ? '#86efac' : '#2e7d32',
                          padding: '2px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: 600,
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: theme.textSecondary }}>
                      {plan.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 800, color: theme.text, letterSpacing: '-0.02em' }}>
                        {plan.price}
                      </span>
                      <span style={{ fontSize: '14px', color: theme.textSecondary }}>
                        {plan.id === 'free' ? '' : plan.period}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {plan.features.map((feature, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '14px', width: '20px', textAlign: 'center', flexShrink: 0,
                          color: feature.included ? '#16a34a' : theme.textSecondary,
                        }}>
                          {feature.included ? '✓' : '—'}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          color: feature.included ? theme.text : theme.textSecondary,
                          opacity: feature.included ? 1 : 0.5,
                        }}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  {isCurrent && (currentPlan === 'pro' || currentPlan === 'premium') ? (
                    <button
                      onClick={handleManageSubscription}
                      disabled={loading === 'manage'}
                      style={{
                        width: '100%', padding: '14px',
                        background: darkMode ? '#3f3f5a' : '#f3f4f6',
                        color: theme.textSecondary,
                        border: 'none', borderRadius: '12px',
                        fontSize: '14px', fontWeight: 600,
                        cursor: loading === 'manage' ? 'wait' : 'pointer',
                      }}
                    >
                      {loading === 'manage' ? 'Opening...' : 'Manage Subscription'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || loading === plan.id}
                      style={{
                        width: '100%', padding: '14px',
                        background: isCurrent
                          ? (darkMode ? '#3f3f5a' : '#f3f4f6')
                          : isUpgrade
                            ? isPremium
                              ? 'linear-gradient(135deg, #7C4DFF 0%, #651FFF 100%)'
                              : 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)'
                            : (darkMode ? '#3f3f5a' : '#f3f4f6'),
                        color: isCurrent
                          ? theme.textSecondary
                          : isUpgrade
                            ? isPremium ? '#fff' : '#5D4037'
                            : theme.textSecondary,
                        border: 'none', borderRadius: '12px',
                        fontSize: '14px', fontWeight: 700,
                        cursor: isCurrent ? 'default' : loading === plan.id ? 'wait' : 'pointer',
                        opacity: isCurrent ? 0.7 : 1,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {loading === plan.id
                        ? 'Redirecting...'
                        : isCurrent
                          ? 'Current Plan'
                          : isUpgrade
                            ? `Upgrade to ${plan.name}`
                            : `Downgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div style={{
          marginTop: isMobile ? '28px' : '40px',
          background: theme.cardBg, borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          padding: isMobile ? '20px' : '28px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: theme.text }}>
            Frequently Asked Questions
          </h3>

          {[
            {
              q: 'Can I cancel anytime?',
              a: 'Yes — cancel your subscription at any time. You\'ll keep access until the end of your current billing period.',
            },
            {
              q: 'What happens to my notes if I downgrade?',
              a: 'All your notes and notebooks stay safe. You\'ll just have fewer AI requests and some features may be locked.',
            },
            {
              q: 'How does billing work?',
              a: 'Subscriptions are billed monthly via Stripe. Your payment info is securely handled by Stripe — we never see or store your card details.',
            },
            {
              q: 'What counts as an AI request?',
              a: 'Summaries and explanations cost 0.5 requests each. Flashcards and chat turns cost 1 request each. On the Free plan, OCR scans also cost 1 request from the shared budget. On Pro/Premium, OCR is tracked separately.',
            },
            {
              q: 'What is Study Chat?',
              a: 'Study Chat is a Premium-only AI chatbot that lets you have a conversation about your notes. Ask questions, get clarifications, and study interactively — all grounded in your note content.',
            },
          ].map((faq, i) => (
            <div key={i} style={{ marginBottom: i < 4 ? '16px' : 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: theme.text }}>
                {faq.q}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary, lineHeight: 1.5 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
