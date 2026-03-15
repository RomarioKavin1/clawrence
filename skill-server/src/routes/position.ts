import { Router, Request, Response } from 'express'
import { isAddress, formatUnits } from 'viem'
import { publicClient } from '../lib/client'
import { VAULT_ABI, CREDIT_SCORE_ABI } from '../lib/abis'

const router = Router()
const VAULT_ADDRESS        = process.env.VAULT_ADDRESS        as `0x${string}`
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
    const [collateral, debt, hf, maxBorrow, collatUSD, score, ltv, streak, totalLoans] =
      await Promise.all([
        publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'collateral',            args: [addr] }),
        publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'debt',                  args: [addr] }),
        publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getHealthFactor',       args: [addr] }),
        publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getMaxBorrow',          args: [addr] }),
        publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getCollateralValueUSD', args: [addr] }),
        publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getScore',              args: [addr] }),
        publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'getLTV',                 args: [addr] }),
        publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'consecutiveRepayments', args: [addr] }),
        publicClient.readContract({ address: CREDIT_SCORE_ADDRESS, abi: CREDIT_SCORE_ABI, functionName: 'totalLoans',            args: [addr] }),
      ])

    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const hfDisplay = hf === MAX_UINT256 ? 'No debt' : `${(Number(hf) / 100).toFixed(2)}x`
    const status = hf === MAX_UINT256 ? 'HEALTHY' : hf < 100n ? 'LIQUIDATABLE' : hf < 120n ? 'WARNING' : 'HEALTHY'

    res.json({
      address: addr,
      creditScore:   Number(score),
      scoreTier:     scoreTier(score),
      ltvPercent:    Number(ltv),
      collateralBTC: formatUnits(collateral, 18),
      collateralUSD: `$${formatUnits(collatUSD, 6)}`,
      debtUSDC:      formatUnits(debt, 6),
      maxBorrowUSDC: formatUnits(maxBorrow, 6),
      healthFactor:  hfDisplay,
      status,
      repayStreak:   Number(streak),
      totalLoans:    Number(totalLoans),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
