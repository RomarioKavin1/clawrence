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
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7260' }}>Loading leaderboard…</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#111', marginBottom: '0.35rem' }}>
          No depositors yet.
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#6B7260' }}>
          Be the first to deposit collateral and build credit.
        </p>
      </div>
    )
  }

  const headers = ['#', 'Agent', 'Score', 'Tier', 'Loans', 'Repaid', 'Streak']

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {headers.map(h => (
                <th key={h} style={{
                  padding: '0.875rem 1rem', textAlign: 'left',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600,
                  fontSize: '0.68rem', letterSpacing: '0.07em',
                  color: '#6B7260', textTransform: 'uppercase',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => (
              <tr
                key={e.address}
                style={{ borderBottom: idx < entries.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.02)' }}
                onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#6B7260' }}>
                  {e.rank}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#111', fontWeight: 500 }}>
                  {e.address.slice(0, 6)}…{e.address.slice(-4)}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#111' }}>
                  {e.score}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <ScoreBadge score={e.score} />
                </td>
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#6B7260' }}>
                  {e.totalLoans}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#6B7260' }}>
                  {e.totalRepaid}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: e.streak > 0 ? '#111' : '#ccc' }}>
                  {e.streak > 0 ? `×${e.streak}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
