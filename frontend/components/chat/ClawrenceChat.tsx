'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'clawrence'
  content: string
}

const WELCOME: Message = {
  role: 'clawrence',
  content: "I'm Clawrence. Not the bank. Better.\n\nConnect your wallet. I'll show you what you can borrow, and what you've earned.",
}

export function ClawrenceChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <div className="glass-panel p-6 flex flex-col h-[600px] relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 group-hover:bg-emerald-500/10 transition-colors duration-500"></div>

      <div className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        Clawrence — Credit Agent
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm font-mono ${m.role === 'clawrence' ? 'text-green-400' : 'text-gray-300'}`}>
            <span className="text-gray-600 mr-2">{m.role === 'clawrence' ? '>' : '$'}</span>
            <span className="whitespace-pre-wrap">{m.content}</span>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div className="text-sm font-mono text-green-400 animate-pulse">{'> '}thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-3">
        <input
          className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 shadow-inner transition-colors"
          placeholder="What's my credit score? / How much can I borrow? / ..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 disabled:opacity-40 text-black font-bold px-6 py-3 rounded-xl text-sm transition-all duration-300 shadow-[0_0_15px_rgba(52,211,153,0.3)] hover:shadow-[0_0_25px_rgba(52,211,153,0.5)] transform hover:-translate-y-0.5"
        >
          Send
        </button>
      </div>
    </div>
  )
}
