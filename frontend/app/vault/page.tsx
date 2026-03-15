import { VaultActions } from '@/components/vault/VaultActions'
import { PositionPanel } from '@/components/position/PositionPanel'

export default function VaultPage() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Vault
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Deposit collateral, borrow USDC, manage your position.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <VaultActions />
        <PositionPanel />
      </div>
    </div>
  )
}
