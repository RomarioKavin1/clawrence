'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { VAULT_ABI, ERC20_ABI, USDC_ADDRESS } from '@/lib/contracts'

interface Message {
  role: 'user' | 'clawrence'
  content: string
}

interface TxItem {
  to: string
  data: string
  value: string
  functionName: string
  args?: unknown
  chainId: number
  step?: number
  stepDescription?: string
}

interface TxData {
  type: 'transaction'
  action: string
  description: string
  transactions: TxItem[]
}

interface SignData {
  type: 'sign'
  action: string
  description: string
  eip712: {
    domain: { name: string; version: string; chainId: number; verifyingContract: string }
    types: Record<string, Array<{ name: string; type: string }>>
    primaryType: string
    message: Record<string, string>
  }
}

// x402 echo reference flow
interface SkillTxData {
  type: 'skill_transaction'
  action: string
  description: string
  orderId: string
  payToAddress: string
  amountWei: string
  tokenContract: string
  chainId: number
  endpoint: string
}

const WELCOME: Message = {
  role: 'clawrence',
  content: "I'm Clawrence. Not the bank. Better.\n\nConnect your wallet. I'll show you what you can borrow, and what you've earned.",
}

function extractTxBlocks(text: string): { clean: string; txBlocks: TxData[] } {
  const txBlocks: TxData[] = []
  const clean = text.replace(/@@TX([\s\S]*?)@@TX/g, (_, json) => {
    try { txBlocks.push(JSON.parse(json)) } catch {}
    return ''
  })
  return { clean, txBlocks }
}

function extractSignBlocks(text: string): { clean: string; signBlocks: SignData[] } {
  const signBlocks: SignData[] = []
  const clean = text.replace(/@@SIGN([\s\S]*?)@@SIGN/g, (_, json) => {
    try { signBlocks.push(JSON.parse(json)) } catch {}
    return ''
  })
  return { clean, signBlocks }
}

function extractSkillTxBlocks(text: string): { clean: string; skillTxBlocks: SkillTxData[] } {
  const skillTxBlocks: SkillTxData[] = []
  const clean = text.replace(/@@SKILL_TX([\s\S]*?)@@SKILL_TX/g, (_, json) => {
    try { skillTxBlocks.push(JSON.parse(json)) } catch {}
    return ''
  })
  return { clean, skillTxBlocks }
}

function cleanDisplayText(text: string): string {
  return text
    .replace(/@@TX[\s\S]*?@@TX/g, '')
    .replace(/@@SIGN[\s\S]*?@@SIGN/g, '')
    .replace(/@@SKILL_TX[\s\S]*?@@SKILL_TX/g, '')
    .replace(/\[calling \w+\.\.\.\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TRANSFER_ABI = [{
  name: 'transfer', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
}] as const

export function ClawrenceChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // @@TX — direct contract transactions via MetaMask
  const executeTx = useCallback(async (txData: TxData) => {
    if (!walletClient || !address || !publicClient) {
      setTxStatus('Connect your wallet first')
      return
    }

    try {
      let lastHash = '' as `0x${string}`
      for (const tx of txData.transactions) {
        const step = tx.step ? `Step ${tx.step}: ` : ''
        const desc = tx.stepDescription || tx.functionName
        setTxStatus(`${step}${desc} — confirm in wallet...`)

        let txDataHex = tx.data as `0x${string}`

        // Replace CONNECTED_WALLET placeholder for borrow/repay
        if (tx.functionName === 'borrow' && typeof tx.args === 'object' && tx.args !== null && 'recipient' in tx.args) {
          const args = tx.args as { recipient: string; amount: string }
          txDataHex = encodeFunctionData({ abi: VAULT_ABI, functionName: 'borrow', args: [address, BigInt(args.amount)] })
        }
        if (tx.functionName === 'repay' && typeof tx.args === 'object' && tx.args !== null && 'onBehalfOf' in tx.args) {
          const args = tx.args as { onBehalfOf: string; amount: string }
          txDataHex = encodeFunctionData({ abi: VAULT_ABI, functionName: 'repay', args: [address, BigInt(args.amount)] })
        }

        lastHash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          data: txDataHex,
          value: BigInt(tx.value || '0'),
          chain: walletClient.chain,
          account: address,
        })

        setTxStatus(`${step}Confirming...`)
        await publicClient.waitForTransactionReceipt({ hash: lastHash })
        setTxStatus(`${step}Confirmed!`)

        // Wait for nonce propagation between steps
        if (txData.transactions.length > 1) {
          await new Promise(r => setTimeout(r, 8000))
        }
      }

      // If this is an x402 deposit, confirm with the skill server using the last tx hash (the transfer)
      if (txData.type === 'x402_deposit' && txData.serverEndpoint) {
        setTxStatus('Confirming deposit with server...')
        await new Promise(r => setTimeout(r, 5000))

        const confirmRes = await fetch(txData.serverEndpoint, {
          method: 'POST',
          headers: {
            'X-From-Address': address,
            'X-Tx-Hash': lastHash as string,
          },
        })

        if (confirmRes.ok) {
          const data = await confirmRes.json()
          setMessages(prev => [...prev, {
            role: 'clawrence',
            content: `Deposit confirmed via x402. ${data.amount} WETH deposited. Total collateral: ${data.totalCollateral} WETH.\n\n— Clawrence`,
          }])
        } else {
          const errText = await confirmRes.text()
          setMessages(prev => [...prev, {
            role: 'clawrence',
            content: `Deposit transfer confirmed but server confirmation failed: ${errText}\n\n— Clawrence`,
          }])
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'clawrence',
          content: `Transaction confirmed: ${txData.description}\n\n— Clawrence`,
        }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTxStatus(`Transaction failed: ${msg.slice(0, 80)}`)
    } finally {
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [walletClient, address, publicClient])

  // @@SKILL_TX — x402 echo flow: pay USDC to payToAddress, then retry with X-Order-ID
  const executeSkillTx = useCallback(async (skillTx: SkillTxData) => {
    if (!walletClient || !address || !publicClient) {
      setTxStatus('Connect your wallet first')
      return
    }

    try {
      // Step 2: Pay USDC to payToAddress via MetaMask (transfer)
      setTxStatus(`${skillTx.description} — confirm USDC transfer in wallet...`)

      const transferData = encodeFunctionData({
        abi: TRANSFER_ABI,
        functionName: 'transfer',
        args: [skillTx.payToAddress as `0x${string}`, BigInt(skillTx.amountWei)],
      })

      const hash = await walletClient.sendTransaction({
        to: USDC_ADDRESS as `0x${string}`,
        data: transferData,
        value: 0n,
        chain: walletClient.chain,
        account: address,
      })

      setTxStatus('Confirming USDC payment...')
      await publicClient.waitForTransactionReceipt({ hash })
      setTxStatus('Payment confirmed. Fetching data...')

      // Step 3: Retry endpoint with X-Order-ID header immediately after receipt
      const res = await fetch(skillTx.endpoint, {
        headers: { 'X-Order-ID': skillTx.orderId },
      })

      if (res.ok) {
        const data = await res.json()
        const lines = Object.entries(data)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')

        setMessages(prev => [...prev, {
          role: 'clawrence',
          content: `Paid $0.10 USDC. Here's your data:\n\n${lines}\n\n— Clawrence`,
        }])
      } else {
        const errBody = await res.text()
        setMessages(prev => [...prev, {
          role: 'clawrence',
          content: `Payment confirmed on-chain. Server returned: ${errBody}\n\nTry asking again.\n\n— Clawrence`,
        }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTxStatus(`Skill payment failed: ${msg.slice(0, 80)}`)
      setMessages(prev => [...prev, {
        role: 'clawrence',
        content: `Payment failed: ${msg.slice(0, 100)}\n\n— Clawrence`,
      }])
    } finally {
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [walletClient, address, publicClient])

  // @@SIGN — EIP-712 sign + send signature back to agent
  const executeSign = useCallback(async (signData: SignData, currentMessages: Message[]) => {
    if (!walletClient || !address) {
      setTxStatus('Connect your wallet first')
      return
    }

    try {
      setTxStatus(`${signData.description} — sign in wallet...`)

      const { domain, types, primaryType, message } = signData.eip712
      const sigTypes = { ...types }
      delete sigTypes['EIP712Domain']

      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: domain.name,
          version: domain.version,
          chainId: domain.chainId,
          verifyingContract: domain.verifyingContract as `0x${string}`,
        },
        types: sigTypes,
        primaryType,
        message,
      })

      setTxStatus('Signature received, sending to Clawrence...')

      const sigMsg: Message = { role: 'user', content: `Signature: ${signature}` }
      const updatedMessages = [...currentMessages, sigMsg]
      setMessages(prev => [...prev, sigMsg, { role: 'clawrence', content: '' }])

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'clawrence', content: accumulated }
          return updated
        })
      }

      setTxStatus(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTxStatus(`Signing failed: ${msg.slice(0, 80)}`)
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [walletClient, address])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, { role: 'clawrence', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'clawrence', content: accumulated }
          return updated
        })
      }

      // Extract all action blocks
      const { clean: c1, txBlocks } = extractTxBlocks(accumulated)
      const { clean: c2, signBlocks } = extractSignBlocks(c1)
      const { clean: c3, skillTxBlocks } = extractSkillTxBlocks(c2)

      const displayText = cleanDisplayText(c3)
      const finalMessages = [...nextMessages, { role: 'clawrence' as const, content: displayText }]
      setMessages(finalMessages)

      // Execute: skill payments → direct txs → sign requests
      for (const skill of skillTxBlocks) await executeSkillTx(skill)
      for (const tx of txBlocks) await executeTx(tx)
      for (const sign of signBlocks) await executeSign(sign, finalMessages)
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'clawrence', content: 'Something went wrong. Try again.\n\n— Clawrence' }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 600 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.25rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid rgba(128,128,128,0.2)' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Clawrence — Credit Agent
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
        {messages.map((m, i) => {
          const displayed = cleanDisplayText(m.content)
          if (!displayed) return null
          const isClawrence = m.role === 'clawrence'
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: isClawrence ? 'var(--text)' : 'var(--text-muted)',
              }}>
                {isClawrence ? 'Clawrence' : 'You'}
              </span>
              <div style={{
                fontFamily: isClawrence ? 'Space Grotesk, sans-serif' : 'Inter, sans-serif',
                fontSize: '0.875rem',
                fontWeight: isClawrence ? 500 : 400,
                color: isClawrence ? 'var(--text)' : 'var(--text-muted)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                background: isClawrence ? 'var(--card-2)' : 'transparent',
                borderRadius: '0.625rem',
                padding: isClawrence ? '0.625rem 0.75rem' : '0',
              }}>
                {displayed}
              </div>
            </div>
          )
        })}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {txStatus && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.875rem',
          background: 'rgba(202,255,0,0.1)',
          borderRadius: '0.5rem',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--accent)',
        }}>
          {txStatus}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          placeholder={isConnected ? "What's my credit score? / Deposit 0.01 WETH / …" : "Connect your wallet first"}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  )
}
