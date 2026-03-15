'use client'

import { useEffect, useState, useCallback } from 'react'
import { LeaderboardTable, type LeaderboardEntry } from '@/components/leaderboard/LeaderboardTable'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch = useCallback(async () => {
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
    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [fetch])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl text-white">Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">Agent credit rankings — live on-chain data.</p>
        </div>
        {lastUpdated && (
          <span className="text-gray-600 font-mono text-xs">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      <LeaderboardTable entries={entries} loading={loading} />
    </div>
  )
}
