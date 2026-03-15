import { createHmac, randomUUID } from 'crypto'

const API_KEY = 'cRXLM3snFjdc7vQVX3xHvMEUgpTjOOpd-UyFz0HhUZg='
const API_SECRET = 'Oc6I_mIwCT1ooct_mk34uGt7JBklNvHTYKncVt4-xG0='
const BASE_URL = 'https://x402-api-lx58aabp0r.testnet3.goat.network'

function signRequest(params: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomUUID()
  const allParams = { ...params, api_key: API_KEY, timestamp, nonce }
  const sortedKeys = Object.keys(allParams).filter(k => allParams[k] !== '').sort()
  const signStr = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&')
  const sign = createHmac('sha256', API_SECRET).update(signStr).digest('hex')
  return { 'X-API-Key': API_KEY, 'X-Timestamp': timestamp, 'X-Nonce': nonce, 'X-Sign': sign }
}

async function main() {
  // Register wallet for merchant on chain 48816
  const body = {
    chain_id: 48816,
    token_symbol: 'USDC',
    token_contract: '0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1',
    address: '0x79bE9Dd3CfB1542fA04CE3954224d1fa71FFf704',
  }

  const strParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    strParams[k] = String(v)
  }
  const headers = signRequest(strParams)

  console.log('Registering wallet for merchant clawrence1...')
  const res = await fetch(`${BASE_URL}/api/v1/merchant/wallets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  console.log('Status:', res.status)
  const text = await res.text()
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)) } catch { console.log(text) }

  // Check merchant info after registration
  console.log('\nChecking merchant info...')
  const merchantRes = await fetch(`${BASE_URL}/merchants/clawrence1`)
  console.log('Status:', merchantRes.status)
  const mText = await merchantRes.text()
  try { console.log(JSON.stringify(JSON.parse(mText), null, 2)) } catch { console.log(mText) }
}

main().catch(console.error)
