import { Router, Request, Response } from 'express'
import { isAddress } from 'viem'
import { publicClient } from '../lib/client'
import { CREDIT_SCORE_ABI } from '../lib/abis'

const router = Router()
const CREDIT_SCORE_ADDRESS = process.env.CREDIT_SCORE_ADDRESS as `0x${string}`

function scoreTier(score: bigint): string {
  if (score >= 95n) return 'Elite'
  if (score >= 85n) return 'Veteran'
  if (score >= 70n) return 'Trusted'
  if (score >= 50n) return 'Basic'
  if (score >= 30n) return 'New'
  return 'Blocked'
}

router.get('/', async (req: Request, res: Response) => {
  const { address } = req.query

  if (!address || !isAddress(address as string)) {
    res.status(400).json({ error: 'Valid ?address=0x... required' })
    return
  }

  const addr = address as `0x${string}`

  try {
    const [score, ltv, streak, lastActivity, totalLoans, totalRepaid, hasHistory] = await Promise.all([
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getScore', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getLTV', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'consecutiveRepayments', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'lastActivityTimestamp', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'totalLoans', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'totalRepaid', args: [addr] }),
      publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'hasHistory', args: [addr] }),
    ])

    const nowSec = BigInt(Math.floor(Date.now() / 1000))
    const inactiveDays = lastActivity > 0n ? Number((nowSec - lastActivity) / 86400n) : 0

    res.json({
      address: addr,
      score: Number(score),
      tier: scoreTier(score),
      ltv: `${ltv}%`,
      consecutiveRepayments: Number(streak),
      totalLoans: Number(totalLoans),
      totalRepaid: Number(totalRepaid),
      hasHistory: Boolean(hasHistory),
      inactiveDays,
      decayRisk: inactiveDays > 30 ? 'HIGH' : inactiveDays > 7 ? 'MEDIUM' : 'NONE',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
