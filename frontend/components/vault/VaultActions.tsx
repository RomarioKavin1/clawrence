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
    chainId: 48816,
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
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', background: 'rgba(0,0,0,0.06)', borderRadius: '0.75rem' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => { setAction(t); setAmount('') }}
            style={{
              flex: 1, padding: '0.5rem',
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: '0.8rem', textTransform: 'capitalize',
              border: 'none', cursor: 'pointer', borderRadius: '0.5rem',
              background: action === t ? '#fff' : 'transparent',
              color: action === t ? '#111' : '#6B7260',
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 600, color: '#6B7260', display: 'block', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Amount ({action === 'deposit' || action === 'withdraw' ? 'BTC' : 'USDC'})
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="input-field"
            style={{ flex: 1 }}
          />
          {action === 'borrow' && maxBorrow !== undefined && (
            <button
              onClick={() => setAmount((Number(maxBorrow) / 1e6).toFixed(2))}
              style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem',
                color: '#111', background: '#CAFF00', border: 'none',
                borderRadius: '0.5rem', padding: '0 0.875rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              MAX
            </button>
          )}
        </div>
        {action === 'borrow' && maxBorrow !== undefined && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#6B7260', marginTop: '0.35rem' }}>
            Max: {(Number(maxBorrow) / 1e6).toFixed(2)} USDC
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={execute}
        disabled={isPending || isConfirming || !amount}
        className="btn-primary"
        style={{ width: '100%', padding: '0.875rem' }}
      >
        {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : action.charAt(0).toUpperCase() + action.slice(1)}
      </button>

      {isSuccess && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#16a34a', textAlign: 'center' }}>
          Transaction confirmed.
        </p>
      )}
    </div>
  )
}
