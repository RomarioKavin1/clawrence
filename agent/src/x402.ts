/**
 * x402 payment client for Clawrence.
 *
 * Flow:
 *  1. Hit skill server endpoint → 402 with { payment: Order }
 *  2. Approve + transfer USDC to order.payToAddress on-chain
 *  3. Poll GoatX402 until PAYMENT_CONFIRMED
 *  4. Retry request with X-Payment-Order-Id header → 200
 */

import { GoatX402Client } from 'goatx402-sdk-server'
import { type Address } from 'viem'
import { publicClient, getWalletClient } from '../lib/client.js'
import { ERC20_ABI } from '../lib/abis.js'

const USDC     = process.env.USDC_ADDRESS         as Address
const PK       = process.env.PRIVATE_KEY          as `0x${string}`
const SKILL_SERVER_URL = process.env.SKILL_SERVER_URL || 'http://localhost:3000'

const goatClient = new GoatX402Client({
  baseUrl:   process.env.GOATX402_API_URL!,
  apiKey:    process.env.GOATX402_API_KEY!,
  apiSecret: process.env.GOATX402_API_SECRET!,
})

async function sendUSDC(to: Address, amountWei: bigint) {
  const { client, account } = getWalletClient(PK)

  const allowance = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, to],
  }) as bigint

  if (allowance < amountWei) {
    const approveTx = await client.writeContract({
      address: USDC, abi: ERC20_ABI, functionName: 'approve',
      args: [to, amountWei], account, chain: client.chain,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const transferAbi = [{
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  }] as const

  const tx = await client.writeContract({
    address: USDC, abi: transferAbi, functionName: 'transfer',
    args: [to, amountWei], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash: tx })
}

/**
 * Make a GET request to the skill server, paying $0.01 USDC via x402 if required.
 * Returns the parsed JSON response.
 */
export async function payAndFetch(path: string, agentAddr: Address): Promise<unknown> {
  const url = `${SKILL_SERVER_URL}${path}`

  // First attempt — no payment header
  const res1 = await fetch(url, {
    headers: { 'x-payer-address': agentAddr },
  })

  if (res1.ok) return res1.json()

  if (res1.status !== 402) {
    throw new Error(`Skill server error ${res1.status}: ${await res1.text()}`)
  }

  // Parse 402 — get payment order
  const body = await res1.json() as { payment: { orderId: string; payToAddress: string; amountWei: string } }
  const { orderId, payToAddress, amountWei } = body.payment

  if (!payToAddress || !amountWei) {
    throw new Error(`Malformed 402 response: ${JSON.stringify(body)}`)
  }

  // Pay on-chain
  await sendUSDC(payToAddress as Address, BigInt(amountWei))

  // Wait for GoatX402 to confirm the payment
  await goatClient.waitForConfirmation(orderId, {
    timeout: 60_000,
    interval: 3_000,
    onStatusChange: (s) => console.log(`  [x402] order ${orderId} → ${s}`),
  })

  // Retry with payment proof
  const res2 = await fetch(url, {
    headers: {
      'x-payer-address':      agentAddr,
      'x-payment-order-id':   orderId,
    },
  })

  if (!res2.ok) {
    throw new Error(`Skill server rejected verified payment: ${await res2.text()}`)
  }

  return res2.json()
}
