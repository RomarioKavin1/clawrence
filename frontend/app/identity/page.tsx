import { IdentityCard } from '@/components/identity/IdentityCard'

export default function IdentityPage() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Identity
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          ERC-8004 agent identities on Celo Sepolia.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Clawrence
          </p>
          <IdentityCard isClawrence />
        </div>
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Your Identity
          </p>
          <IdentityCard />
        </div>
      </div>
    </div>
  )
}
