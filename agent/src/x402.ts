import { createThirdwebClient } from 'thirdweb'
import { wrapFetchWithPayment } from 'thirdweb/x402'
import { privateKeyToAccount } from 'thirdweb/wallets'

const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID!,
})

const account = privateKeyToAccount({
  client,
  privateKey: process.env.PRIVATE_KEY!,
})

export const fetchWithPayment = wrapFetchWithPayment({
  client,
  account,
})

const SKILL_SERVER_URL = process.env.SKILL_SERVER_URL || 'http://localhost:3000'

export async function payAndFetch(path: string): Promise<unknown> {
  const url = `${SKILL_SERVER_URL}${path}`
  const response = await fetchWithPayment(url)
  return response.json()
}
