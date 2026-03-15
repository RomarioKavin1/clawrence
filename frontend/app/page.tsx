import { ClawrenceChat } from '@/components/chat/ClawrenceChat'
import { PositionPanel } from '@/components/position/PositionPanel'

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Welcome to <span className="text-gradient">Clawrence</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Your on-chain credit agent. Deposit collateral, build reputation, and borrow USDC with unmatched efficiency.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClawrenceChat />
        <PositionPanel />
      </div>
    </div>
  )
}
