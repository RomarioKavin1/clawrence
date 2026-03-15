import { createHmac, randomUUID } from 'crypto'

const API_KEY = 'cRXLM3snFjdc7vQVX3xHvMEUgpTjOOpd-UyFz0HhUZg='
const API_SECRET = 'Oc6I_mIwCT1ooct_mk34uGt7JBklNvHTYKncVt4-xG0='
const BASE_URL = 'https://x402-api-lx58aabp0r.testnet3.goat.network'
const MERCHANT_ID = 'clawrence1'

function signRequest(params: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomUUID()

  const allParams: Record<string, string> = { ...params, api_key: API_KEY, timestamp, nonce }
  const sortedKeys = Object.keys(allParams).filter(k => allParams[k] !== '').sort()
  const signStr = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&')
  const sign = createHmac('sha256', API_SECRET).update(signStr).digest('hex')

  return {
    'X-API-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Sign': sign,
  }
}

async function request(method: string, path: string, body?: Record<string, any>) {
  const url = `${BASE_URL}${path}`
  const strParams: Record<string, string> = {}
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) strParams[k] = String(v)
    }
  }
  const authHeaders = signRequest(strParams)

  console.log(`\n--- ${method} ${path} ---`)
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  console.log(`Status: ${res.status}`)
  try {
    const json = JSON.parse(text)
    console.log(JSON.stringify(json, null, 2))
    return json
  } catch {
    console.log(text)
    return text
  }
}

async function main() {
  // 1. Check merchant info (public, no auth needed)
  console.log('=== Step 1: Get merchant info ===')
  const merchantRes = await fetch(`${BASE_URL}/merchants/${MERCHANT_ID}`)
  const merchantText = await merchantRes.text()
  console.log(`Status: ${merchantRes.status}`)
  try { console.log(JSON.stringify(JSON.parse(merchantText), null, 2)) } catch { console.log(merchantText) }

  // 2. Create a payment order
  console.log('\n=== Step 2: Create payment order ===')
  const order = await request('POST', '/api/v1/orders', {
    dapp_order_id: `test-${Date.now()}`,
    chain_id: 48816,
    token_symbol: 'USDC',
    token_contract: '0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1',
    from_address: '0x79bE9Dd3CfB1542fA04CE3954224d1fa71FFf704',
    amount_wei: '100000', // $0.10 USDC (6 decimals, minimum)
  })

  // 3. Check order status
  if (order?.order_id) {
    console.log('\n=== Step 3: Check order status ===')
    await request('GET', `/api/v1/orders/${order.order_id}`)
  }
}

main().catch(console.error)
