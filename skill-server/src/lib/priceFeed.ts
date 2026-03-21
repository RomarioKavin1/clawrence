import WebSocket from 'ws'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celoSepolia } from './chain'
import { VAULT_ABI } from './abis'

let ethPrice: number = 0
let priceTimestamp: number = 0
let ws: WebSocket | null = null

export function getEthPrice() {
  return { ethPrice, priceTimestamp }
}

export function connectBybitWS() {
  ws = new WebSocket('wss://stream.bybit.com/v5/public/spot')

  ws.on('open', () => {
    ws!.send(JSON.stringify({
      op: 'subscribe',
      args: ['tickers.ETHUSDT'],
    }))
    console.log('[price] Connected to Bybit WS')
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.topic === 'tickers.ETHUSDT' && msg.data) {
        ethPrice = parseFloat(msg.data.lastPrice)
        priceTimestamp = Date.now()
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log('[price] WS closed, reconnecting in 5s...')
    setTimeout(connectBybitWS, 5000)
  })

  ws.on('error', (err) => {
    console.error('[price] WS error:', err.message)
  })
}

export async function pushPriceOnChain() {
  if (ethPrice === 0) {
    console.log('[price] No price data yet, skipping push')
    return
  }

  const pk = process.env.PRIVATE_KEY as `0x${string}`
  if (!pk) {
    console.log('[price] No PRIVATE_KEY, skipping price push')
    return
  }

  const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}`
  if (!vaultAddress) return

  try {
    const account = privateKeyToAccount(pk)
    const client = createWalletClient({
      account,
      chain: celoSepolia,
      transport: http(),
    })

    const priceScaled = BigInt(Math.round(ethPrice * 1e8))
    const timestamp = BigInt(Math.floor(priceTimestamp / 1000))

    const hash = await client.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'setPrice',
      args: [priceScaled, timestamp],
      account,
      chain: celoSepolia,
    })

    console.log(`[price] Pushed ETH/USD $${ethPrice.toFixed(2)} on-chain, tx: ${hash}`)
  } catch (err) {
    console.error('[price] Failed to push price:', err instanceof Error ? err.message : err)
  }
}

export function startPriceKeeper() {
  connectBybitWS()
  setInterval(pushPriceOnChain, 5 * 60 * 1000)
  setTimeout(pushPriceOnChain, 10_000)
}
