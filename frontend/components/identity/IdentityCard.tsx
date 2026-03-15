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
      <div className="glass-panel p-6 space-y-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -z-10 group-hover:bg-green-500/10 transition-colors duration-500"></div>
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-sm text-green-400 font-bold">CLAWRENCE</h3>
          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded font-mono">x402 enabled</span>
        </div>
        <div className="space-y-1 text-xs font-mono text-gray-400">
          <div className="flex justify-between">
            <span className="text-gray-600">Agent ID</span>
            <span>{agentId ?? 'Pending registration'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Network</span>
            <span>GOAT Testnet3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Services</span>
            <span>credit-score, borrow-capacity, market-rate</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price</span>
            <span>$0.01 USDC per call</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 font-mono italic border-t border-gray-800 pt-3">
          &ldquo;I&apos;m Clawrence. Not the bank. Better.&rdquo;
        </p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="glass-panel text-center text-gray-500 py-12 font-mono text-sm">
        Connect wallet to view your identity
      </div>
    )
  }

  return (
    <div className="glass-panel p-6 space-y-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -z-10 group-hover:bg-cyan-500/10 transition-colors duration-500"></div>
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm text-white font-bold">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </h3>
        <ScoreBadge score={Number(score ?? 50n)} />
      </div>
      <div className="space-y-1 text-xs font-mono text-gray-400">
        <div className="flex justify-between">
          <span className="text-gray-600">Credit Score</span>
          <span className="text-green-400">{String(score ?? 50n)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Network</span>
          <span>GOAT Testnet3</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">ERC-8004 Agent ID</span>
          <span className="text-gray-600">{agentId ? `#${agentId}` : 'Not registered'}</span>
        </div>
      </div>
    </div>
  )
}
