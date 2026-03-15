'use client'

import { useAccount, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { VAULT_ADDRESS, CREDIT_SCORE_ADDRESS, VAULT_ABI, CREDIT_SCORE_ABI } from '@/lib/contracts'
import { ScoreBadge } from '@/components/ScoreBadge'

export function PositionPanel() {
  const { address, isConnected } = useAccount()

  const { data, isLoading } = useReadContracts({
    contracts: address ? [
      { address: VAULT_ADDRESS,        abi: VAULT_ABI,        functionName: 'collateral',            args: [address], chainId: 48816 },
      { address: VAULT_ADDRESS,        abi: VAULT_ABI,        functionName: 'debt',                  args: [address], chainId: 48816 },
      { address: VAULT_ADDRESS,        abi: VAULT_ABI,        functionName: 'getHealthFactor',        args: [address], chainId: 48816 },
      { address: VAULT_ADDRESS,        abi: VAULT_ABI,        functionName: 'getMaxBorrow',           args: [address], chainId: 48816 },
      { address: VAULT_ADDRESS,        abi: VAULT_ABI,        functionName: 'getCollateralValueUSD',  args: [address], chainId: 48816 },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getScore',              args: [address], chainId: 48816 },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getLTV',                args: [address], chainId: 48816 },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'consecutiveRepayments', args: [address], chainId: 48816 },
    ] : [],
    query: { refetchInterval: 15_000 },
  })

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Connect wallet to view position</p>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="card" style={{ padding: '1.5rem', minHeight: 420 }}>
        <div style={{ height: 12, width: 100, background: 'var(--card-2)', borderRadius: 6, marginBottom: '1.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ height: 80, background: 'var(--card-2)', borderRadius: '0.75rem' }} />
          ))}
        </div>
      </div>
    )
  }

  const extractValue = (item: any): bigint => {
    if (typeof item === 'bigint') return item
    if (item && typeof item === 'object' && 'result' in item && typeof item.result === 'bigint') return item.result
    return 0n
  }

  const collateral = extractValue(data?.[0])
  const debt       = extractValue(data?.[1])
  const hf         = extractValue(data?.[2])
  const maxBorrow  = extractValue(data?.[3])
  const collatUSD  = extractValue(data?.[4])
  const score      = extractValue(data?.[5]) || 50n
  const ltv        = extractValue(data?.[6])
  const streak     = extractValue(data?.[7])

  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const hfNum = Number(hf) || 0
  const hfDisplay = hf === MAX_UINT256 ? '∞' : `${(hfNum / 100).toFixed(2)}x`
  const hfColor = hf < 120n && hf !== MAX_UINT256 ? '#dc2626' : hf < 150n ? '#d97706' : '#16a34a'

  const safeFormat = (val: bigint, dec: number, fixed?: number) => {
    try {
      const parsed = parseFloat(formatUnits(val, dec))
      if (isNaN(parsed)) return fixed !== undefined ? (0).toFixed(fixed) : '0'
      return fixed !== undefined ? parsed.toFixed(fixed) : parsed.toString()
    } catch {
      return fixed !== undefined ? (0).toFixed(fixed) : '0'
    }
  }

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.25rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid rgba(128,128,128,0.2)' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Live Position
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
        <StatBox label="Credit Score" value={`${score}`}>
          <ScoreBadge score={Number(score)} />
        </StatBox>
        <StatBox label="LTV Tier" value={`${ltv}%`} />
        <StatBox label="Collateral" value={`${safeFormat(collateral, 18, 6)} BTC`} />
        <StatBox label="Collateral USD" value={`$${safeFormat(collatUSD, 6, 2)}`} />
        <StatBox label="Debt" value={`${safeFormat(debt, 6, 2)} USDC`} />
        <StatBox label="Max Borrow" value={`${safeFormat(maxBorrow, 6, 2)} USDC`} />
        <StatBox label="Health Factor" value={hfDisplay} valueColor={hfColor} />
        <StatBox label="Repay Streak" value={`${streak}`} />
      </div>
    </div>
  )
}

function StatBox({ label, value, valueColor, children }: {
  label: string; value: string; valueColor?: string; children?: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
      <div className="stat-label" style={{ marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: valueColor || 'var(--text)', lineHeight: 1.2 }}>
        {value}
      </div>
      {children && <div style={{ marginTop: '0.35rem' }}>{children}</div>}
    </div>
  )
}
