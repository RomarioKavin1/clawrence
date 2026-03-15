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
      <div className="glass-panel p-8 flex flex-col items-center justify-center text-gray-400 h-full min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <p className="font-mono text-sm tracking-wide">Connect wallet to view position</p>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-6 animate-pulse flex flex-col h-full min-h-[400px]">
        <div className="h-4 w-32 bg-white/10 rounded mb-8"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-xl border border-white/5"></div>
          ))}
        </div>
      </div>
    )
  }

  const extractValue = (item: any): bigint => {
    if (typeof item === 'bigint') return item;
    if (item && typeof item === 'object' && 'result' in item && typeof item.result === 'bigint') return item.result;
    return 0n;
  }

  const collateral  = extractValue(data?.[0])
  const debt        = extractValue(data?.[1])
  const hf          = extractValue(data?.[2])
  const maxBorrow   = extractValue(data?.[3])
  const collatUSD   = extractValue(data?.[4])
  const score       = extractValue(data?.[5]) || 50n
  const ltv         = extractValue(data?.[6])
  const streak      = extractValue(data?.[7])

  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const hfNum = Number(hf) || 0
  const hfDisplay = hf === MAX_UINT256 ? '∞' : `${(hfNum / 100).toFixed(2)}x`
  const hfColor = hf < 120n && hf !== MAX_UINT256 ? 'text-red-400' : hf < 150n ? 'text-yellow-400' : 'text-green-400'

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
    <div className="glass-panel p-6 space-y-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 group-hover:bg-cyan-500/10 transition-colors duration-500"></div>
      
      <h2 className="font-mono text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
        Live Position
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Credit Score" value={`${score}`} accent>
          <ScoreBadge score={Number(score)} />
        </Stat>
        <Stat label="LTV Tier" value={`${ltv}%`} />
        <Stat label="Collateral" value={`${safeFormat(collateral, 18, 6)} BTC`} />
        <Stat label="Collateral USD" value={`$${safeFormat(collatUSD, 6, 2)}`} />
        <Stat label="Debt" value={`${safeFormat(debt, 6, 2)} USDC`} />
        <Stat label="Max Borrow" value={`${safeFormat(maxBorrow, 6, 2)} USDC`} />
        <Stat label="Health Factor" value={hfDisplay} className={hfColor} />
        <Stat label="Repay Streak" value={`${streak}`} />
      </div>
    </div>
  )
}

function Stat({
  label, value, accent, className, children
}: {
  label: string; value: string; accent?: boolean; className?: string; children?: React.ReactNode
}) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 backdrop-blur-sm shadow-inner hover:bg-white/5 transition-colors duration-300">
      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">{label}</div>
      <div className={`font-mono text-lg font-medium ${accent ? 'text-gradient' : className || 'text-white'}`}>
        {value}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
