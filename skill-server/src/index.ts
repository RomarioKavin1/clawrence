import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import { GoatX402Client } from 'goatx402-sdk-server'
import creditScoreRouter from './routes/creditScore'
import borrowCapacityRouter from './routes/borrowCapacity'
import marketRateRouter from './routes/marketRate'

const app = express()
app.use(express.json())

const goatClient = new GoatX402Client({
  baseUrl:   process.env.GOATX402_API_URL!,
  apiKey:    process.env.GOATX402_API_KEY!,
  apiSecret: process.env.GOATX402_API_SECRET!,
})

const CHAIN_ID         = 48816
const USDC_SYMBOL      = 'USDC'
const USDC_CONTRACT    = (process.env.USDC_ADDRESS || '0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1') as `0x${string}`

/**
 * x402 payment middleware.
 * - No X-Payment-Order-Id header → create order, return 402 with payment info.
 * - Has X-Payment-Order-Id → verify proof and allow through.
 */
function requirePayment(amountUsdc: string) {
  const amountWei = String(Math.round(parseFloat(amountUsdc) * 1e6))

  return async (req: Request, res: Response, next: NextFunction) => {
    const orderId = req.headers['x-payment-order-id'] as string | undefined

    if (!orderId) {
      // No payment provided — create an order and return 402
      const payerAddress = (req.headers['x-payer-address'] as string) || '0x0000000000000000000000000000000000000000'
      try {
        const order = await goatClient.createOrder({
          dappOrderId:   `clawrence-${Date.now()}`,
          chainId:       CHAIN_ID,
          tokenSymbol:   USDC_SYMBOL,
          tokenContract: USDC_CONTRACT,  // real USDC on GOAT Testnet3
          fromAddress:   payerAddress,
          amountWei,
        })
        res.status(402).json({
          error:    'Payment required',
          amount:   `${amountUsdc} USDC`,
          payment:  order,
          hint:     'Complete payment and retry with X-Payment-Order-Id header',
        })
      } catch {
        // No credentials configured yet — allow through for local dev
        next()
      }
      return
    }

    // Verify the proof
    try {
      const proof = await goatClient.getOrderProof(orderId)
      if (!proof) {
        res.status(402).json({ error: 'Payment proof not found or not confirmed', orderId })
        return
      }
      next()
    } catch {
      res.status(402).json({ error: 'Failed to verify payment', orderId })
    }
  }
}

// Health check (free)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'clawrence-skill-server' })
})

// Paywalled endpoints — $0.01 USDC each
app.use('/credit-score',    requirePayment('0.01'), creditScoreRouter)
app.use('/borrow-capacity', requirePayment('0.01'), borrowCapacityRouter)
app.use('/market-rate',     requirePayment('0.01'), marketRateRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Clawrence skill server running on port ${PORT}`)
})

export default app
