/**
 * Test x402 payment flow against the Clawrence skill server on Celo Sepolia.
 *
 * This script:
 * 1. Hits a paywalled endpoint and gets a 402 response
 * 2. Parses the payment requirements from the 402 response
 * 3. Pays USDC on-chain via thirdweb/viem
 * 4. Retries with proof of payment
 *
 * Usage:
 *   PRIVATE_KEY=0x... SKILL_SERVER_URL=http://localhost:3001 npx tsx test-x402-payment.ts
 */

import { createPublicClient, createWalletClient, http, defineChain, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Celoscan',
      url: 'https://celo-sepolia.celoscan.io',
    },
  },
  testnet: true,
})

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  const skillServerUrl = process.env.SKILL_SERVER_URL || 'http://localhost:3001'

  if (!privateKey) {
    console.error('Set PRIVATE_KEY env var (0x-prefixed)')
    process.exit(1)
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(),
  })

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport: http(),
  })

  const testAddress = account.address
  const endpoint = `${skillServerUrl}/credit-score?address=${testAddress}`

  // Step 1: Hit paywalled endpoint, expect 402
  console.log('=== Step 1: Request paywalled endpoint ===')
  console.log(`GET ${endpoint}`)
  const res = await fetch(endpoint)
  console.log(`Status: ${res.status}`)
  const body = await res.text()
  console.log('Body:', body)

  if (res.status !== 402) {
    console.log('Expected 402 response. Endpoint may not be paywalled or server is down.')
    return
  }

  // Step 2: Parse payment details from 402 response
  let paymentDetails: { payTo: string; amount: string; token: string; orderId?: string }
  try {
    paymentDetails = JSON.parse(body)
  } catch {
    console.log('Could not parse 402 response body as JSON. Raw:', body)
    return
  }

  console.log('\n=== Step 2: Payment details from 402 ===')
  console.log('Pay to:', paymentDetails.payTo)
  console.log('Amount:', paymentDetails.amount)
  console.log('Token:', paymentDetails.token)

  if (!paymentDetails.payTo || !paymentDetails.amount || !paymentDetails.token) {
    console.log('Missing payment details in 402 response.')
    return
  }

  // Step 3: Pay USDC on-chain
  console.log('\n=== Step 3: Sending USDC payment on-chain ===')
  const hash = await walletClient.writeContract({
    address: paymentDetails.token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [paymentDetails.payTo as `0x${string}`, BigInt(paymentDetails.amount)],
  })

  console.log('Tx hash:', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status)
  console.log('Block:', receipt.blockNumber.toString())

  // Step 4: Retry with payment proof
  console.log('\n=== Step 4: Retry with payment proof ===')
  const retryRes = await fetch(endpoint, {
    headers: {
      'X-Payment-Tx': hash,
      ...(paymentDetails.orderId ? { 'X-Order-ID': paymentDetails.orderId } : {}),
    },
  })
  console.log(`Status: ${retryRes.status}`)
  const retryBody = await retryRes.text()
  try {
    console.log(JSON.stringify(JSON.parse(retryBody), null, 2))
  } catch {
    console.log(retryBody)
  }
}

main().catch(console.error)
