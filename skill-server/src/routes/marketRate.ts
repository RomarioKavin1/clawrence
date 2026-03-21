import { Router, Request, Response } from 'express'
import { formatUnits } from 'viem'
import { publicClient } from '../lib/client'
import { ERC20_ABI, VAULT_ABI } from '../lib/abis'
import { getEthPrice } from '../lib/priceFeed'

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

    const { ethPrice, priceTimestamp } = getEthPrice()
    const ethPriceStr = ethPrice > 0 ? `$${ethPrice.toFixed(2)}` : 'unavailable'
    const ageSec = priceTimestamp > 0 ? Math.floor((Date.now() - priceTimestamp) / 1000) : Infinity
    const oracleStale = ageSec > 3600

    res.json({
      availableLiquidityUSDC: formatUnits(vaultBalance, 6),
      ethUsdPrice: ethPriceStr,
      oracleStale,
      priceSource: 'Bybit WS',
      baseAPR: '8%',
      network: 'Celo Sepolia',
      chainId: 11142220,
      vaultAddress: VAULT_ADDRESS,
      usdcAddress: USDC_ADDRESS,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
