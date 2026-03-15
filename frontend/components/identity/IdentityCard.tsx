'use client'

import { useAccount, useReadContract } from 'wagmi'
import { CREDIT_SCORE_ADDRESS, CREDIT_SCORE_ABI } from '@/lib/contracts'
import { ScoreBadge } from '@/components/ScoreBadge'

interface Props {
  isClawrence?: boolean
  agentId?: number
}

export function IdentityCard({ isClawrence, agentId }: Props) {
  const { address, isConnected } = useAccount()

  const { data: score } = useReadContract({
    address: CREDIT_SCORE_ADDRESS,
    abi: CREDIT_SCORE_ABI,
    functionName: 'getScore',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !isClawrence },
  })

  if (isClawrence) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', borderRadius: 9999,
          padding: '0.25rem 0.625rem', marginBottom: '1.25rem',
        }}>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent-fg)', letterSpacing: '-0.01em' }}>
            CLAWRENCE
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.65rem', color: '#3a3f28', letterSpacing: '0.04em' }}>
            x402 enabled
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Agent ID', value: agentId != null ? String(agentId) : 'Pending registration' },
            { label: 'Network', value: 'GOAT Testnet3' },
            { label: 'Services', value: 'credit-score, borrow-capacity, market-rate' },
            { label: 'Price', value: '$0.01 USDC per call' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {row.label}
              </span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontStyle: 'italic',
          color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
          paddingTop: '1rem', marginTop: '0.5rem',
        }}>
          &ldquo;I&apos;m Clawrence. Not the bank. Better.&rdquo;
        </p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Connect wallet to view your identity
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        <ScoreBadge score={Number(score ?? 50n)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[
          { label: 'Credit Score', value: String(score ?? 50n), highlight: true },
          { label: 'Network', value: 'GOAT Testnet3', highlight: false },
          { label: 'ERC-8004 Agent ID', value: agentId != null ? `#${agentId}` : 'Not registered', highlight: false },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {row.label}
            </span>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.8rem', fontWeight: 700,
              color: row.highlight ? 'var(--text)' : 'var(--text-muted)',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
