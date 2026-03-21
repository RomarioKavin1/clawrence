import 'dotenv/config'
import express, { Request, Response } from 'express'
import { createThirdwebClient } from 'thirdweb'
import { settlePayment, facilitator } from 'thirdweb/x402'
import { celoSepolia } from './lib/chain'
import { startPriceKeeper } from './lib/priceFeed'
import positionRouter from './routes/position'
import creditScoreRouter from './routes/creditScore'
import borrowCapacityRouter from './routes/borrowCapacity'
import marketRateRouter from './routes/marketRate'
import depositRouter from './routes/deposit'

const app = express()
app.use(express.json())

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-From-Address, X-Payment, Payment-Signature, X-Tx-Hash')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

const SKILL_PRICE = '0.10'
const hasThirdwebKey = !!process.env.THIRDWEB_SECRET_KEY

let thirdwebClient: any = null
let thirdwebFacilitator: any = null

if (hasThirdwebKey) {
  thirdwebClient = createThirdwebClient({
    secretKey: process.env.THIRDWEB_SECRET_KEY!,
  })
  thirdwebFacilitator = facilitator({
    client: thirdwebClient,
    serverWalletAddress: process.env.SERVER_WALLET_ADDRESS!,
  })
}

function requirePayment(price: string) {
  return async (req: Request, res: Response, next: Function) => {
    // Skip payment gate if thirdweb is not configured
    if (!hasThirdwebKey) return next()

    const paymentData = req.headers['payment-signature'] as string || req.headers['x-payment'] as string

    try {
      const result = await settlePayment({
        resourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        method: 'GET',
        paymentData,
        payTo: process.env.SERVER_WALLET_ADDRESS!,
        network: celoSepolia,
        price,
        facilitator: thirdwebFacilitator,
      })

      if (result.status === 200) {
        return next()
      }

      res.status(result.status)
      if (result.responseHeaders) {
        Object.entries(result.responseHeaders).forEach(([k, v]) => res.setHeader(k, v as string))
      }
      res.json(result.responseBody)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[x402] Payment error:', msg)
      res.status(500).json({ error: 'Payment processing failed', detail: msg })
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'clawrence-skill-server', network: 'Celo Sepolia' })
})

// x402 WETH deposit — has its own custom payment flow, no thirdweb middleware
app.use('/deposit', depositRouter)

app.use('/position', requirePayment(SKILL_PRICE), positionRouter)
app.use('/credit-score', requirePayment(SKILL_PRICE), creditScoreRouter)
app.use('/borrow-capacity', requirePayment(SKILL_PRICE), borrowCapacityRouter)
app.use('/market-rate', requirePayment(SKILL_PRICE), marketRateRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Clawrence skill server running on port ${PORT}`)
  console.log(hasThirdwebKey
    ? `x402 payment: ${SKILL_PRICE} USDC per skill call (thirdweb, Celo Sepolia)`
    : `x402 payment: DISABLED (no THIRDWEB_SECRET_KEY) — endpoints are free`)
  startPriceKeeper()
})

export default app
