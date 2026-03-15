'use client'

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'

// Stub data — replace with event-indexed data post-deploy
const STUB_ENTRIES = [
  { rank: 1, address: '0x0000000000000000000000000000000000000001', score: 92, totalLoans: 12, totalRepaid: '4800 USDC', streak: 5, status: 'active' as const },
  { rank: 2, address: '0x0000000000000000000000000000000000000002', score: 78, totalLoans: 7,  totalRepaid: '2100 USDC', streak: 3, status: 'active' as const },
  { rank: 3, address: '0x0000000000000000000000000000000000000003', score: 55, totalLoans: 3,  totalRepaid: '450 USDC',  streak: 1, status: 'active' as const },
]

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl text-white">Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">Agent credit rankings — live data requires event indexer post-deploy.</p>
        </div>
      </div>
      <LeaderboardTable entries={STUB_ENTRIES} />
    </div>
  )
}
