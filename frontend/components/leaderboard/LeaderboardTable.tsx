import { ScoreBadge } from '@/components/ScoreBadge'

export interface LeaderboardEntry {
  rank: number
  address: string
  score: number
  totalLoans: number
  totalRepaid: string
  streak: number
  status: 'active' | 'defaulted' | 'blocked'
}

interface Props {
  entries: LeaderboardEntry[]
  loading?: boolean
}

export function LeaderboardTable({ entries, loading }: Props) {
  if (loading) {
    return (
      <div className="glass-panel text-center py-12">
        <div className="text-gray-500 font-mono text-sm animate-pulse">Loading leaderboard...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="glass-panel text-center py-16">
        <p className="text-gray-400 font-mono text-sm">No borrowers yet.</p>
        <p className="text-gray-500 font-mono text-xs mt-2">Be the first to borrow from Clawrence.</p>
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-x-auto relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10"></div>
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-white/10 bg-black/20">
            <th className="py-4 px-6 font-semibold">#</th>
            <th className="py-4 pr-6 font-semibold">Agent</th>
            <th className="py-4 pr-6 font-semibold">Score</th>
            <th className="py-4 pr-6 font-semibold">Tier</th>
            <th className="py-4 pr-6 font-semibold">Loans</th>
            <th className="py-4 pr-6 font-semibold">Repaid</th>
            <th className="py-4 pr-6 font-semibold">Streak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map(e => (
            <tr key={e.address} className="hover:bg-white/5 transition-colors group">
              <td className="py-4 px-6 text-gray-500 group-hover:text-white transition-colors">{e.rank}</td>
              <td className="py-4 pr-6 text-gray-300">{e.address.slice(0, 6)}...{e.address.slice(-4)}</td>
              <td className="py-4 pr-6 text-white font-bold">{e.score}</td>
              <td className="py-4 pr-6"><ScoreBadge score={e.score} /></td>
              <td className="py-4 pr-6 text-gray-400">{e.totalLoans}</td>
              <td className="py-4 pr-6 text-gray-400">{e.totalRepaid}</td>
              <td className="py-4 pr-6 text-emerald-400">{e.streak > 0 ? `x${e.streak}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
