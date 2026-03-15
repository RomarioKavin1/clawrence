interface Props { score: number }

export function ScoreBadge({ score }: Props) {
  const { label, bg, color } = (() => {
    if (score >= 95) return { label: 'Elite',   bg: '#CAFF00',                color: '#111111' }
    if (score >= 85) return { label: 'Veteran', bg: 'var(--text)',             color: 'var(--bg)' }
    if (score >= 70) return { label: 'Trusted', bg: 'rgba(128,128,128,0.15)', color: 'var(--text)' }
    if (score >= 50) return { label: 'Basic',   bg: 'rgba(128,128,128,0.1)',  color: 'var(--text-muted)' }
    if (score >= 30) return { label: 'New',     bg: 'rgba(128,128,128,0.07)', color: 'var(--text-muted)' }
    return              { label: 'Blocked', bg: 'rgba(239,68,68,0.15)',    color: '#ef4444' }
  })()

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem', borderRadius: 9999,
      background: bg, color,
      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.7rem',
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
