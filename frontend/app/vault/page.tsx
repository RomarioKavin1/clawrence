import { VaultActions } from '@/components/vault/VaultActions'
import { PositionPanel } from '@/components/position/PositionPanel'

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl text-white">Vault</h1>
        <p className="text-gray-500 text-sm mt-1">Deposit collateral, borrow USDC, manage your position.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VaultActions />
        <PositionPanel />
      </div>
    </div>
  )
}
