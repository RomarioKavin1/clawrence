import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits } from 'viem'
import { goatTestnet3 } from '@/lib/chains'
import { VAULT_ADDRESS, CREDIT_SCORE_ADDRESS, CREDIT_SCORE_ABI } from '@/lib/contracts'

const client = createPublicClient({
  chain: goatTestnet3,
  transport: http(),
})

// Deployment block — don't scan from 0 on a chain at block 12M
const DEPLOY_BLOCK = 12019598n

const DEPOSITED_EVENT = {
  name: 'Deposited',
  type: 'event',
  inputs: [
    { name: 'agent', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
} as const

const BORROWED_EVENT = {
  name: 'Borrowed',
  type: 'event',
  inputs: [
    { name: 'recipient', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'healthFactor', type: 'uint256', indexed: false },
  ],
} as const

export async function GET() {
  try {
    if (VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json([])
    }

    const [depositedLogs, borrowedLogs] = await Promise.all([
      client.getLogs({ address: VAULT_ADDRESS, event: DEPOSITED_EVENT, fromBlock: DEPLOY_BLOCK }),
      client.getLogs({ address: VAULT_ADDRESS, event: BORROWED_EVENT, fromBlock: DEPLOY_BLOCK }),
    ])

    const addressSet = new Set<string>()
    for (const log of depositedLogs) {
      if (log.args.agent) addressSet.add(log.args.agent.toLowerCase())
    }
    for (const log of borrowedLogs) {
      if (log.args.recipient) addressSet.add(log.args.recipient.toLowerCase())
    }

    const addresses = Array.from(addressSet) as `0x${string}`[]
    if (addresses.length === 0) return NextResponse.json([])

    const calls = addresses.flatMap(addr => [
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getScore' as const, args: [addr] },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'totalLoans' as const, args: [addr] },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'totalRepaid' as const, args: [addr] },
      { address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'consecutiveRepayments' as const, args: [addr] },
    ])

    const results = await client.multicall({
      contracts: calls,
      allowFailure: true,
      multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    })

    const entries = addresses.map((addr, i) => {
      const base = i * 4
      const score = Number((results[base].result as bigint) ?? 0n)
      const totalLoans = Number((results[base + 1].result as bigint) ?? 0n)
      const totalRepaid = (results[base + 2].result as bigint) ?? 0n
      const streak = Number((results[base + 3].result as bigint) ?? 0n)

      return {
        address: addr,
        score,
        totalLoans,
        totalRepaid: `${formatUnits(totalRepaid, 6)} USDC`,
        streak,
      }
    })

    entries.sort((a, b) => b.score - a.score)

    return NextResponse.json(entries.map((e, i) => ({ rank: i + 1, ...e })))
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
