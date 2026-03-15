'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, parseEther } from 'viem'
import { VAULT_ADDRESS, VAULT_ABI } from '@/lib/contracts'

type Action = 'deposit' | 'borrow' | 'repay' | 'withdraw'

export function VaultActions() {
  const { address } = useAccount()
  const [action, setAction] = useState<Action>('deposit')
  const [amount, setAmount] = useState('')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: maxBorrow } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getMaxBorrow',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  function execute() {
    if (!address || !amount) return
    const parsedAmount = action === 'deposit' || action === 'withdraw'
      ? parseEther(amount)
      : parseUnits(amount, 6)

    if (action === 'deposit') {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'deposit', args: [], value: parsedAmount })
    } else if (action === 'borrow') {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'borrow', args: [address, parsedAmount] })
    } else if (action === 'repay') {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'repay', args: [address, parsedAmount] })
    } else {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdraw', args: [parsedAmount] })
    }
  }

  const tabs: Action[] = ['deposit', 'borrow', 'repay', 'withdraw']

  return (
    <div className="glass-panel p-6 space-y-6 max-w-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
      
      <div className="flex gap-2 p-1 bg-black/20 border border-white/5 rounded-lg">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => { setAction(t); setAmount('') }}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider rounded-md transition-all duration-300
              ${action === t ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs text-gray-500 font-mono mb-1 uppercase tracking-wider">
          Amount ({action === 'deposit' || action === 'withdraw' ? 'BTC' : 'USDC'})
        </label>
        <div className="flex gap-2.5">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 shadow-inner transition-colors"
          />
          {action === 'borrow' && maxBorrow !== undefined && (
            <button
              onClick={() => setAmount((Number(maxBorrow) / 1e6).toFixed(2))}
              className="text-xs text-green-500 hover:text-green-400 font-mono border border-green-800 px-2 rounded"
            >
              MAX
            </button>
          )}
        </div>
        {action === 'borrow' && maxBorrow !== undefined && (
          <p className="text-xs text-gray-600 font-mono mt-1">
            Max available: {(Number(maxBorrow) / 1e6).toFixed(2)} USDC
          </p>
        )}
      </div>

      <button
        onClick={execute}
        disabled={isPending || isConfirming || !amount}
        className="w-full bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 text-black font-bold py-3.5 rounded-xl text-sm transition-all duration-300 shadow-[0_0_15px_rgba(52,211,153,0.2)] disabled:shadow-none"
      >
        {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : action.toUpperCase()}
      </button>

      {isSuccess && (
        <p className="text-xs text-green-400 font-mono">Transaction confirmed.</p>
      )}
    </div>
  )
}
