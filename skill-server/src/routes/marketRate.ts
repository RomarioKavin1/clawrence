import { Router, Request, Response } from 'express'
import { formatUnits } from 'viem'
import { publicClient } from '../lib/client'
import { ERC20_ABI, DIA_ORACLE_ABI } from '../lib/abis'

const router = Router()
const VAULT_ADDRESS  = process.env.VAULT_ADDRESS as `0x${string}`
const USDC_ADDRESS   = process.env.USDC_ADDRESS as `0x${string}`
const DIA_ORACLE     = (process.env.DIA_ORACLE_ADDRESS || '0xef094fff94a7954ba3e5ed81dbafe7350e7e9720') as `0x${string}`

router.get('/', async (_req: Request, res: Response) => {
  try {
    const vaultBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [VAULT_ADDRESS],
    })

    // Fetch oracle price
    let btcPrice = 'unavailable'
    let oracleStale = false
    try {
      const [price, timestamp] = await publicClient.readContract({
        address: DIA_ORACLE,
        abi: DIA_ORACLE_ABI,
        functionName: 'getValue',
        args: ['BTC/USD'],
      }) as [bigint, bigint]

      btcPrice = `$${(Number(price) / 1e8).toFixed(2)}`
      const ageSec = Math.floor(Date.now() / 1000) - Number(timestamp)
      oracleStale = ageSec > 3600
    } catch {}

    res.json({
      availableLiquidityUSDC: formatUnits(vaultBalance, 6),
      btcUsdPrice: btcPrice,
      oracleStale,
      baseAPR: '8%',
      network: 'GOAT Testnet3',
      chainId: 48816,
      vaultAddress: VAULT_ADDRESS,
      usdcAddress: USDC_ADDRESS,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
