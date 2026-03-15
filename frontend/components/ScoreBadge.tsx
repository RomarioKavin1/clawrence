interface Props { score: number }

export function ScoreBadge({ score }: Props) {
  const { label, color } = (() => {
    if (score >= 95) return { label: 'Elite',    color: 'text-yellow-400 border-yellow-400' }
    if (score >= 85) return { label: 'Veteran',  color: 'text-blue-400 border-blue-400' }
    if (score >= 70) return { label: 'Trusted',  color: 'text-green-400 border-green-400' }
    if (score >= 50) return { label: 'Basic',    color: 'text-gray-400 border-gray-600' }
    if (score >= 30) return { label: 'New',      color: 'text-gray-500 border-gray-700' }
    return              { label: 'Blocked',  color: 'text-red-400 border-red-400' }
  })()

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${color}`}>
      {label}
    </span>
  )
}
