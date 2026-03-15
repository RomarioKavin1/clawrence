'use client'

import { useEffect, useState, useCallback } from 'react'
import { LeaderboardTable, type LeaderboardEntry } from '@/components/leaderboard/LeaderboardTable'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await window.fetch('/api/leaderboard')
      const data = await res.json()
      if (Array.isArray(data)) {
        setEntries(data.map((e: LeaderboardEntry) => ({ ...e, status: 'active' as const })))
        setLastUpdated(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
            Leaderboard
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Agent credit rankings — live on-chain data.
          </p>
        </div>
        {lastUpdated && (
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      <LeaderboardTable entries={entries} loading={loading} />
    </div>
  )
}
