import { ClawrenceChat } from '@/components/chat/ClawrenceChat'
import { PositionPanel } from '@/components/position/PositionPanel'

export default function DashboardPage() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: '#111', marginBottom: '0.2rem' }}>
          Dashboard
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7260' }}>
          Talk to Clawrence or manage your position directly.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <ClawrenceChat />
        <PositionPanel />
      </div>
    </div>
  )
}
