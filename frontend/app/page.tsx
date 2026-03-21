import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

      {/* Hero */}
      <div style={{ marginBottom: '3rem', maxWidth: 680 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', borderRadius: 9999,
          padding: '0.3rem 0.75rem', marginBottom: '1.5rem',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-fg)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.06em', color: 'var(--accent-fg)' }}>
            LIVE ON CELO SEPOLIA
          </span>
        </div>

        <h1 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 800,
          fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
          marginBottom: '1rem',
        }}>
          Credit infrastructure<br />for autonomous agents.
        </h1>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '1.05rem',
          color: 'var(--text-muted)',
          lineHeight: 1.65,
          maxWidth: 480,
          marginBottom: '2rem',
        }}>
          Deposit WETH, build on-chain reputation, borrow USDC to pay for x402 services. No human approvals. Fully autonomous.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-primary">
            Open App
          </Link>
          <Link href="/leaderboard" style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '0.875rem',
            color: 'var(--text-muted)', textDecoration: 'none', padding: '0.7rem 0',
          }}>
            View Leaderboard →
          </Link>
        </div>
      </div>

      {/* Bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.875rem' }}>

        {/* Score engine — wide */}
        <div className="card" style={{ gridColumn: 'span 7', padding: '2rem', position: 'relative' }}>
          <p className="stat-label" style={{ marginBottom: '0.5rem' }}>Credit Score Engine</p>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>On-chain reputation that compounds.</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 360, marginBottom: '1.5rem' }}>
            Scores from 0–100 based on utilization weighting, loan duration, and repayment streaks. Decay-protected against gaming.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Elite 95+', bg: '#CAFF00', color: '#111' },
              { label: 'Veteran 85+', bg: 'var(--text)', color: 'var(--bg)' },
              { label: 'Trusted 70+', bg: 'rgba(128,128,128,0.15)', color: 'var(--text)' },
            ].map(t => (
              <span key={t.label} style={{
                background: t.bg, color: t.color,
                borderRadius: 9999, padding: '0.3rem 0.875rem',
                fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem',
              }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* LTV tiers — dark card */}
        <div className="card" style={{ gridColumn: 'span 5', padding: '2rem', background: 'var(--bg-2)' }}>
          <p className="stat-label" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>LTV Tiers</p>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '1.25rem' }}>Better score, more capital.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              { range: 'Score 95–100', ltv: '100%', accent: true },
              { range: 'Score 85–95', ltv: '92%', accent: false },
              { range: 'Score 70–85', ltv: '85%', accent: false },
              { range: 'Score 50–70', ltv: '75%', accent: false },
              { range: 'Score 30–50', ltv: '65%', accent: false },
            ].map(row => (
              <div key={row.range} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '0.45rem 0.75rem', borderRadius: '0.5rem',
                background: row.accent ? '#CAFF00' : 'rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: row.accent ? '#111' : 'var(--text-muted)', fontWeight: 500 }}>
                  {row.range}
                </span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: row.accent ? '#111' : 'var(--text)' }}>
                  {row.ltv}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card: Autonomous */}
        <div className="card" style={{ gridColumn: 'span 4', padding: '2rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '0.625rem',
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <svg width="20" height="20" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <p className="stat-label" style={{ marginBottom: '0.4rem' }}>Autonomous</p>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>No human in the loop.</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Clawrence evaluates and executes borrows autonomously. Agents access capital without permission gates.
          </p>
        </div>

        {/* Card: x402 — lime */}
        <div className="card" style={{ gridColumn: 'span 4', padding: '2rem', background: '#CAFF00', border: 'none' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '0.625rem',
            background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <p className="stat-label" style={{ color: '#5a6040', marginBottom: '0.4rem' }}>x402 Payments</p>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', color: '#111' }}>Close the loop.</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#3a3f28', lineHeight: 1.55 }}>
            Borrow USDC from Clawrence to pay Clawrence&apos;s own x402 endpoints. A self-contained autonomous economy.
          </p>
        </div>

        {/* Card: ERC-8004 */}
        <div className="card" style={{ gridColumn: 'span 4', padding: '2rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '0.625rem',
            background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <svg width="20" height="20" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <p className="stat-label" style={{ marginBottom: '0.4rem' }}>ERC-8004 Identity</p>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Composable credit.</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Every score is written to the Celo agent registry. Any protocol can read credit history — Clawrence is infrastructure.
          </p>
        </div>

        {/* How it works */}
        <div className="card" style={{ gridColumn: 'span 12', padding: '2rem' }}>
          <p className="stat-label" style={{ marginBottom: '1.5rem' }}>How It Works</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
            {[
              { n: '01', title: 'Deposit WETH', body: 'Lock WETH as collateral in the ClawrenceVault smart contract.' },
              { n: '02', title: 'Build Reputation', body: 'Borrow responsibly. Utilization, duration, and streaks build your score.' },
              { n: '03', title: 'Unlock Capital', body: 'Higher scores unlock better LTV — up to 100% for Elite agents.' },
              { n: '04', title: 'Pay Services', body: 'Borrow USDC autonomously to pay x402 endpoints. No human required.' },
            ].map(s => (
              <div key={s.n}>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800,
                  fontSize: '2rem', color: 'var(--accent)',
                  WebkitTextStroke: '1.5px var(--text-muted)', marginBottom: '0.5rem',
                }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>{s.title}</h3>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CTA */}
      <div className="card" style={{ marginTop: '0.875rem', padding: '2.5rem', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', marginBottom: '0.4rem' }}>Ready to borrow?</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Connect on Celo Sepolia. No sign-up. Just on-chain reputation.
          </p>
        </div>
        <Link href="/dashboard" className="btn-accent">Open Dashboard</Link>
      </div>

    </div>
  )
}
