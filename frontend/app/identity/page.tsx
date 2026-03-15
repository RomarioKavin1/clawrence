import { IdentityCard } from '@/components/identity/IdentityCard'

export default function IdentityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl text-white">Identity</h1>
        <p className="text-gray-500 text-sm mt-1">ERC-8004 agent identities on GOAT Testnet3.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-3">Clawrence</h2>
          <IdentityCard isClawrence />
        </div>
        <div>
          <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-3">Your Identity</h2>
          <IdentityCard />
        </div>
      </div>
    </div>
  )
}
