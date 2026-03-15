'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseEther, parseUnits } from 'viem'
import { VAULT_ABI, ERC20_ABI, VAULT_ADDRESS, USDC_ADDRESS } from '@/lib/contracts'

interface Message {
  role: 'user' | 'clawrence'
  content: string
}

interface TxData {
  type: 'transaction'
  action: string
  description: string
  transactions: Array<{
    to: string
    data: string
    value: string
    functionName: string
    args: unknown
    chainId: number
    step?: number
    stepDescription?: string
  }>
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

const WELCOME: Message = {
  role: 'clawrence',
  content: "I'm Clawrence. Not the bank. Better.\n\nConnect your wallet. I'll show you what you can borrow, and what you've earned.",
}

// Extract @@TX{...}@@TX blocks from text
function extractTxBlocks(text: string): { clean: string; txBlocks: TxData[] } {
  const txBlocks: TxData[] = []
  const clean = text.replace(/@@TX([\s\S]*?)@@TX/g, (_, json) => {
    try { txBlocks.push(JSON.parse(json)) } catch {}
    return ''
  })
  return { clean, txBlocks }
}

// Extract @@SIGN{...}@@SIGN blocks from text
function extractSignBlocks(text: string): { clean: string; signBlocks: SignData[] } {
  const signBlocks: SignData[] = []
  const clean = text.replace(/@@SIGN([\s\S]*?)@@SIGN/g, (_, json) => {
    try { signBlocks.push(JSON.parse(json)) } catch {}
    return ''
  })
  return { clean, signBlocks }
}

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

  // Execute a @@TX transaction via MetaMask
  const executeTx = useCallback(async (txData: TxData) => {
    if (!walletClient || !address || !publicClient) {
      setTxStatus('Connect your wallet first')
      return
    }

    try {
      for (const tx of txData.transactions) {
        const step = tx.step ? `Step ${tx.step}: ` : ''
        const desc = tx.stepDescription || tx.functionName
        setTxStatus(`${step}${desc} — confirm in wallet...`)

        // For borrow/repay: replace placeholder address with connected wallet
        let txDataHex = tx.data as `0x${string}`
        if (tx.functionName === 'borrow' && typeof tx.args === 'object' && tx.args !== null && 'recipient' in tx.args) {
          const args = tx.args as { recipient: string; amount: string }
          txDataHex = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'borrow',
            args: [address, BigInt(args.amount)],
          })
        }
        if (tx.functionName === 'repay' && typeof tx.args === 'object' && tx.args !== null && 'onBehalfOf' in tx.args) {
          const args = tx.args as { onBehalfOf: string; amount: string }
          txDataHex = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'repay',
            args: [address, BigInt(args.amount)],
          })
        }

        const hash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          data: txDataHex,
          value: BigInt(tx.value || '0'),
          chain: walletClient.chain,
          account: address,
        })

        setTxStatus(`${step}Confirming...`)
        await publicClient.waitForTransactionReceipt({ hash })
        setTxStatus(`${step}Confirmed! Tx: ${hash.slice(0, 10)}...`)
      }

      // Add success message to chat
      setMessages(prev => [...prev, {
        role: 'clawrence',
        content: `Transaction confirmed: ${txData.description}\n\n— Clawrence`,
      }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTxStatus(`Transaction failed: ${msg.slice(0, 80)}`)
    } finally {
      setTimeout(() => setTxStatus(null), 5000)
    }
  }, [walletClient, address, publicClient])

  // Execute a @@SIGN request via MetaMask signTypedData, then send signature back
  const executeSign = useCallback(async (signData: SignData, currentMessages: Message[]) => {
    if (!walletClient || !address) {
      setTxStatus('Connect your wallet first')
      return
    }

    try {
      setTxStatus(`${signData.description} — sign in wallet...`)

      const { domain, types, primaryType, message } = signData.eip712

      // Remove EIP712Domain from types if present (walletClient adds it)
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

      // Send signature back to agent as a new user message
      const sigMsg: Message = { role: 'user', content: `Signature: ${signature}` }
      const updatedMessages = [...currentMessages, sigMsg]
      setMessages(prev => [...prev, sigMsg, { role: 'clawrence', content: '' }])

      // Stream the agent's response
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
        const snap = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'clawrence', content: snap }
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

    // Add empty Clawrence message to stream into
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
        const snap = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'clawrence', content: snap }
          return updated
        })
      }

      // After streaming completes, check for @@TX and @@SIGN blocks in the full stream
      const { clean: cleanTx, txBlocks } = extractTxBlocks(accumulated)
      const { clean: cleanAll, signBlocks } = extractSignBlocks(cleanTx)

      // Clean up displayed message — remove markers, [calling...] lines, and extra whitespace
      const displayText = cleanAll
        .replace(/\[calling \w+\.\.\.\]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      const finalMessages = [...nextMessages, { role: 'clawrence' as const, content: displayText }]
      setMessages(finalMessages)

      // Execute transactions
      for (const tx of txBlocks) {
        await executeTx(tx)
      }

      // Execute sign requests
      for (const sign of signBlocks) {
        await executeSign(sign, finalMessages)
      }
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

  // Render message content, hiding any @@TX/@@SIGN blocks from display
  function renderContent(content: string) {
    return content
      .replace(/@@TX[\s\S]*?@@TX/g, '')
      .replace(/@@SIGN[\s\S]*?@@SIGN/g, '')
      .trim()
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 600 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.25rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#CAFF00', border: '1.5px solid rgba(0,0,0,0.2)' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.07em', color: '#6B7260', textTransform: 'uppercase' }}>
          Clawrence — Credit Agent
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
        {messages.map((m, i) => {
          const displayed = renderContent(m.content)
          if (!displayed) return null
          const isClawrence = m.role === 'clawrence'
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: isClawrence ? '#111' : '#6B7260',
              }}>
                {isClawrence ? 'Clawrence' : 'You'}
              </span>
              <div style={{
                fontFamily: isClawrence ? 'Space Grotesk, sans-serif' : 'Inter, sans-serif',
                fontSize: '0.875rem',
                fontWeight: isClawrence ? 500 : 400,
                color: isClawrence ? '#111' : '#6B7260',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                background: isClawrence ? 'rgba(0,0,0,0.03)' : 'transparent',
                borderRadius: '0.625rem',
                padding: isClawrence ? '0.625rem 0.75rem' : '0',
              }}>
                {displayed}
              </div>
            </div>
          )
        })}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#6B7260' }}>
            thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Transaction status bar */}
      {txStatus && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.875rem',
          background: '#CAFF00',
          borderRadius: '0.5rem',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#111',
        }}>
          {txStatus}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          placeholder={isConnected ? "What's my credit score? / Deposit 0.01 BTC / …" : "Connect your wallet first"}
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
