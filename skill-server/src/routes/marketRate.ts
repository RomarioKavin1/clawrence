import { Router, Request, Response } from 'express'
import { formatUnits } from 'viem'
import { publicClient } from '../lib/client'
import { ERC20_ABI } from '../lib/abis'

const router = Router()
const VAULT_ADDRESS  = process.env.VAULT_ADDRESS as `0x${string}`
const USDC_ADDRESS   = process.env.USDC_ADDRESS as `0x${string}`

router.get('/', async (_req: Request, res: Response) => {
  try {
    const vaultBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [VAULT_ADDRESS],
    })

    res.json({
      availableLiquidityUSDC: formatUnits(vaultBalance, 6),
      baseAPR: '8%',
      network: 'GOAT Testnet3',
      chainId: 48816,
      vaultAddress: VAULT_ADDRESS,
      usdcAddress: USDC_ADDRESS,
      note: 'APR is fixed at 8% for testnet.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
