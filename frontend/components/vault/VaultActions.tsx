'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, parseEther, type Address } from 'viem'
import { VAULT_ADDRESS, VAULT_ABI, WETH_ADDRESS, ERC20_ABI } from '@/lib/contracts'

type Action = 'deposit' | 'borrow' | 'repay' | 'withdraw'

const SKILL_SERVER_URL = process.env.NEXT_PUBLIC_SKILL_SERVER_URL || 'http://localhost:3000'

export function VaultActions() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [action, setAction] = useState<Action>('deposit')
  const [amount, setAmount] = useState('')
  const [depositStep, setDepositStep] = useState<'approve' | 'transfer' | 'confirming'>('approve')
  const [depositStatus, setDepositStatus] = useState('')

  const { writeContractAsync, writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: maxBorrow } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getMaxBorrow',
    args: address ? [address] : undefined,
    chainId: 11142220,
    query: { enabled: !!address },
  })

  async function executeDeposit() {
    if (!address || !amount || !publicClient) return
    const parsedAmount = parseEther(amount)

    try {
      // Step 1: Hit /deposit to get 402 with payTo address
      setDepositStatus('Getting deposit instructions...')
      const res = await fetch(`${SKILL_SERVER_URL}/deposit?amount=${amount}`, {
        method: 'POST',
        headers: { 'X-From-Address': address },
      })

      if (res.status !== 402) {
        setDepositStatus(`Error: ${await res.text()}`)
        return
      }

      const order = await res.json()
      const payTo = order.payTo as Address

      // Step 2: Approve WETH to server wallet
      setDepositStep('approve')
      setDepositStatus('Approve WETH in wallet...')
      const approveTx = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [payTo, parsedAmount],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Wait for nonce to propagate to sequencer
      await new Promise(r => setTimeout(r, 3000))

      // Step 3: Transfer WETH to server wallet
      setDepositStep('transfer')
      setDepositStatus('Transfer WETH in wallet...')
      const transferTx = await writeContractAsync({
        address: WETH_ADDRESS,
        abi: [{
          name: 'transfer', type: 'function', stateMutability: 'nonpayable',
          inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
          outputs: [{ type: 'bool' }],
        }] as const,
        functionName: 'transfer',
        args: [payTo, parsedAmount],
      })
      await publicClient.waitForTransactionReceipt({ hash: transferTx })

      // Wait for nonce to propagate before server sends its tx
      await new Promise(r => setTimeout(r, 3000))

      // Step 4: Confirm deposit with server
      setDepositStep('confirming')
      setDepositStatus('Server depositing to vault...')
      const confirmRes = await fetch(`${SKILL_SERVER_URL}/deposit?amount=${amount}`, {
        method: 'POST',
        headers: {
          'X-From-Address': address,
          'X-Tx-Hash': transferTx,
        },
      })

      if (confirmRes.ok) {
        const data = await confirmRes.json()
        setDepositStatus(`Deposited ${data.amount} WETH. Total collateral: ${data.totalCollateral} WETH`)
      } else {
        setDepositStatus(`Server error: ${await confirmRes.text()}`)
      }
    } catch (err) {
      setDepositStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }

    setDepositStep('approve')
  }

  function execute() {
    if (!address || !amount) return

    if (action === 'deposit') {
      executeDeposit()
      return
    }

    const parsedAmount = action === 'withdraw'
      ? parseEther(amount)
      : parseUnits(amount, 6)

    if (action === 'borrow') {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'borrow', args: [address, parsedAmount] })
    } else if (action === 'repay') {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'repay', args: [address, parsedAmount] })
    } else {
      writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdraw', args: [parsedAmount] })
    }
  }

  const tabs: Action[] = ['deposit', 'borrow', 'repay', 'withdraw']

  const getButtonLabel = () => {
    if (action === 'deposit') {
      if (depositStep === 'approve') return 'Deposit via x402'
      if (depositStep === 'transfer') return 'Transferring...'
      if (depositStep === 'confirming') return 'Confirming...'
    }
    if (isPending) return 'Confirm in wallet…'
    if (isConfirming) return 'Confirming…'
    return action.charAt(0).toUpperCase() + action.slice(1)
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', background: 'var(--card-2)', borderRadius: '0.75rem' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => { setAction(t); setAmount(''); setDepositStep('approve'); setDepositStatus('') }}
            style={{
              flex: 1, padding: '0.5rem',
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: '0.8rem', textTransform: 'capitalize',
              border: 'none', cursor: 'pointer', borderRadius: '0.5rem',
              background: action === t ? 'var(--bg-2)' : 'transparent',
              color: action === t ? 'var(--text)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        <label style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Amount ({action === 'deposit' || action === 'withdraw' ? 'WETH' : 'USDC'})
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
                color: 'var(--accent-fg)', background: 'var(--accent)', border: 'none',
                borderRadius: '0.5rem', padding: '0 0.875rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              MAX
            </button>
          )}
        </div>
        {action === 'borrow' && maxBorrow !== undefined && (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Max: {(Number(maxBorrow) / 1e6).toFixed(2)} USDC
          </p>
        )}
      </div>

      <button
        onClick={execute}
        disabled={isPending || isConfirming || !amount || depositStep !== 'approve'}
        className="btn-primary"
        style={{ width: '100%', padding: '0.875rem' }}
      >
        {getButtonLabel()}
      </button>

      {depositStatus && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: depositStatus.startsWith('Error') ? '#dc2626' : 'var(--text-muted)', textAlign: 'center' }}>
          {depositStatus}
        </p>
      )}

      {isSuccess && action !== 'deposit' && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#16a34a', textAlign: 'center' }}>
          Transaction confirmed.
        </p>
      )}
    </div>
  )
}
