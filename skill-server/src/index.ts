import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import { GoatX402Client } from 'goatx402-sdk-server'
import positionRouter from './routes/position'
import creditScoreRouter from './routes/creditScore'
import borrowCapacityRouter from './routes/borrowCapacity'
import marketRateRouter from './routes/marketRate'

const app = express()
app.use(express.json())

// CORS
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-From-Address, X-Order-ID')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

const goatClient = new GoatX402Client({
  baseUrl:   process.env.GOATX402_API_URL!,
  apiKey:    process.env.GOATX402_API_KEY!,
  apiSecret: process.env.GOATX402_API_SECRET!,
})

const CHAIN_ID      = 48816
const USDC_SYMBOL   = 'USDC'
const USDC_CONTRACT = (process.env.USDC_ADDRESS || '0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1') as `0x${string}`
const SKILL_PRICE   = '0.10'

// In-memory payment cache (matches echo reference)
const paidOrders = new Map<string, { orderId: string; paidAt: string; fromAddress: string; amountWei: string; txHash: string }>()

/**
 * x402 payment middleware — matches the echo reference flow exactly:
 *
 * 1. No X-Order-ID header → create order via GoatX402, return 402
 * 2. Has X-Order-ID, already cached → allow through
 * 3. Has X-Order-ID, not cached → check getOrderStatus for PAYMENT_CONFIRMED or INVOICED
 */
function requirePayment(amountUsdc: string) {
  const amountWei = String(Math.round(parseFloat(amountUsdc) * 1e6))

  return async (req: Request, res: Response, next: NextFunction) => {
    const orderId = req.headers['x-order-id'] as string | undefined

    if (!orderId) {
      const fromAddress = (req.headers['x-from-address'] as string) || '0x0000000000000000000000000000000000000000'

      try {
        const order = await goatClient.createOrder({
          dappOrderId:   `clawrence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          chainId:       CHAIN_ID,
          tokenSymbol:   USDC_SYMBOL,
          tokenContract: USDC_CONTRACT,
          fromAddress,
          amountWei,
        })

        res.status(402).json({
          error:        'Payment required',
          orderId:      order.orderId,
          flow:         order.flow || 'ERC20_DIRECT',
          payToAddress: order.payToAddress,
          amountWei:    order.amountWei || amountWei,
          tokenSymbol:  USDC_SYMBOL,
          chainId:      CHAIN_ID,
          expiresAt:    order.expiresAt,
          instructions: `Pay ${amountUsdc} USDC to ${order.payToAddress} on chain ${CHAIN_ID}, then retry with header: X-Order-ID: ${order.orderId}`,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[x402] Order creation failed:', msg)
        res.status(500).json({ error: 'Failed to create payment order', detail: msg })
      }
      return
    }

    // Already verified this order? Let it through (cache hit)
    if (paidOrders.has(orderId)) {
      ;(req as any).payment = paidOrders.get(orderId)
      return next()
    }

    // Verify payment via getOrderStatus (matches echo reference)
    try {
      const status = await goatClient.getOrderStatus(orderId)

      if (status.status === 'PAYMENT_CONFIRMED' || status.status === 'INVOICED') {
        const paymentInfo = {
          orderId,
          paidAt:      status.confirmedAt || new Date().toISOString(),
          fromAddress: status.fromAddress || '',
          amountWei:   status.amountWei || amountWei,
          txHash:      status.txHash || '',
        }
        paidOrders.set(orderId, paymentInfo)
        ;(req as any).payment = paymentInfo
        console.log(`[x402] Payment verified: ${orderId} (${amountUsdc} USDC, tx: ${status.txHash})`)
        return next()
      }

      res.status(402).json({
        error:   'Payment not confirmed',
        orderId,
        status:  status.status,
        message: `Order status is ${status.status}. Pay first, then retry.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[x402] Status check failed:', msg)
      res.status(402).json({ error: 'Could not verify payment', detail: msg })
    }
  }
}

// Health check (free)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'clawrence-skill-server' })
})

// x402 paywalled endpoints — $0.10 USDC each (echo reference flow)
app.use('/position',        requirePayment(SKILL_PRICE), positionRouter)
app.use('/credit-score',    requirePayment(SKILL_PRICE), creditScoreRouter)
app.use('/borrow-capacity', requirePayment(SKILL_PRICE), borrowCapacityRouter)
app.use('/market-rate',     requirePayment(SKILL_PRICE), marketRateRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Clawrence skill server running on port ${PORT}`)
  console.log(`x402 payment: ${SKILL_PRICE} USDC per skill call`)
})

export default app
