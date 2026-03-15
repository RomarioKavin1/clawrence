import { Router, Request, Response } from 'express'
import { isAddress, formatUnits } from 'viem'
import { publicClient } from '../lib/client'
import { VAULT_ABI } from '../lib/abis'

const router = Router()
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x${string}`

router.get('/', async (req: Request, res: Response) => {
  const { address } = req.query

  if (!address || !isAddress(address as string)) {
    res.status(400).json({ error: 'Valid ?address=0x... required' })
    return
  }

  const addr = address as `0x${string}`

  try {
    const [hf, maxBorrow, collatValueUSD, collateral, debt] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getHealthFactor', args: [addr] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getMaxBorrow', args: [addr] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getCollateralValueUSD', args: [addr] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'collateral', args: [addr] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'debt', args: [addr] }),
    ])

    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const hfDisplay = hf === MAX_UINT256
      ? 'No debt'
      : `${(Number(hf) / 100).toFixed(2)}x`

    const status = hf === MAX_UINT256
      ? 'HEALTHY'
      : hf < 100n
        ? 'LIQUIDATABLE'
        : hf < 120n
          ? 'WARNING'
          : 'HEALTHY'

    res.json({
      address: addr,
      collateralBTC: formatUnits(collateral, 18),
      collateralValueUSD: `$${formatUnits(collatValueUSD, 6)}`,
      currentDebtUSDC: formatUnits(debt, 6),
      maxAdditionalBorrowUSDC: formatUnits(maxBorrow, 6),
      healthFactor: hfDisplay,
      status,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: 'Failed to read on-chain data', detail: message })
  }
})

export default router
