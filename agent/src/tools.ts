import { formatUnits, parseEther, parseUnits, recoverMessageAddress, type Address } from 'viem'
import { publicClient, getWalletClient } from '../lib/client.js'
import { VAULT_ABI, CREDIT_SCORE_ABI, ERC20_ABI } from '../lib/abis.js'

// ── Challenge store (in-memory, expires in 5 minutes) ─────────────────────────
interface Challenge { message: string; amount: string; expiresAt: number }
const pendingChallenges = new Map<string, Challenge>()

export function generateChallenge(address: Address, amountUsdc: string): string {
  const nonce = Date.now()
  const expiresAt = nonce + 5 * 60 * 1000
  const message = [
    'Clawrence borrow authorization',
    `Address: ${address}`,
    `Amount: ${amountUsdc} USDC`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join('\n')
  pendingChallenges.set(address.toLowerCase(), { message, amount: amountUsdc, expiresAt })
  return message
}

export async function verifySignature(address: Address, signature: `0x${string}`): Promise<boolean> {
  const key = address.toLowerCase()
  const challenge = pendingChallenges.get(key)
  if (!challenge) return false
  if (Date.now() > challenge.expiresAt) { pendingChallenges.delete(key); return false }
  const recovered = await recoverMessageAddress({ message: challenge.message, signature })
  return recovered.toLowerCase() === key
}

export function getPendingChallenge(address: Address): Challenge | undefined {
  return pendingChallenges.get(address.toLowerCase())
}

export function consumeChallenge(address: Address): Challenge | undefined {
  const key = address.toLowerCase()
  const c = pendingChallenges.get(key)
  pendingChallenges.delete(key)
  return c
}

const VAULT    = process.env.VAULT_ADDRESS        as Address
const CS       = process.env.CREDIT_SCORE_ADDRESS as Address
const USDC     = process.env.USDC_ADDRESS         as Address
const PK       = process.env.PRIVATE_KEY          as `0x${string}`

// ── Read tools ────────────────────────────────────────────────────────────────

export async function getPosition(address: Address) {
  const [collateral, debt, hf, maxBorrow, collatUSD, score, ltv, streak, totalLoans] =
    await Promise.all([
      publicClient.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'collateral',            args: [address] }),
      publicClient.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'debt',                  args: [address] }),
      publicClient.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'getHealthFactor',        args: [address] }),
      publicClient.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'getMaxBorrow',           args: [address] }),
      publicClient.readContract({ address: VAULT, abi: VAULT_ABI, functionName: 'getCollateralValueUSD',  args: [address] }),
      publicClient.readContract({ address: CS,    abi: CREDIT_SCORE_ABI, functionName: 'getScore',        args: [address] }),
      publicClient.readContract({ address: CS,    abi: CREDIT_SCORE_ABI, functionName: 'getLTV',          args: [address] }),
      publicClient.readContract({ address: CS,    abi: CREDIT_SCORE_ABI, functionName: 'consecutiveRepayments', args: [address] }),
      publicClient.readContract({ address: CS,    abi: CREDIT_SCORE_ABI, functionName: 'totalLoans',      args: [address] }),
    ])

  const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const hfDisplay = hf === MAX_UINT256 ? 'No debt' : `${(Number(hf) / 100).toFixed(2)}x`
  const status = hf === MAX_UINT256 ? 'HEALTHY' : hf < 100n ? 'LIQUIDATABLE' : hf < 120n ? 'WARNING' : 'HEALTHY'

  const scoreTier = (s: bigint) =>
    s >= 95n ? 'Elite' : s >= 85n ? 'Veteran' : s >= 70n ? 'Trusted' : s >= 50n ? 'Basic' : s >= 30n ? 'New' : 'Blocked'

  return {
    address,
    creditScore:      Number(score),
    scoreTier:        scoreTier(score as bigint),
    ltvPercent:       Number(ltv),
    collateralBTC:    formatUnits(collateral as bigint, 18),
    collateralUSD:    `$${formatUnits(collatUSD as bigint, 6)}`,
    debtUSDC:         formatUnits(debt as bigint, 6),
    maxBorrowUSDC:    formatUnits(maxBorrow as bigint, 6),
    healthFactor:     hfDisplay,
    status,
    repayStreak:      Number(streak),
    totalLoans:       Number(totalLoans),
  }
}

// ── Write tools ───────────────────────────────────────────────────────────────

export async function depositBTC(amountEther: string) {
  const { client, account } = getWalletClient(PK)
  const value = parseEther(amountEther)
  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'deposit',
    args: [], value,
    account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountEther} BTC` }
}

export async function borrowUSDC(recipient: Address, amountUsdc: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseUnits(amountUsdc, 6)
  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'borrow',
    args: [recipient, amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountUsdc} USDC`, recipient }
}

export async function repayUSDC(onBehalfOf: Address, amountUsdc: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseUnits(amountUsdc, 6)

  const allowance = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, VAULT],
  })
  if ((allowance as bigint) < amount) {
    const approveTx = await client.writeContract({
      address: USDC, abi: ERC20_ABI, functionName: 'approve',
      args: [VAULT, amount], account, chain: client.chain,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'repay',
    args: [onBehalfOf, amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountUsdc} USDC`, onBehalfOf }
}

export async function withdrawBTC(amountEther: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseEther(amountEther)
  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'withdraw',
    args: [amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountEther} BTC` }
}

export function agentAddress(): Address {
  const { account } = getWalletClient(PK)
  return account.address
}

// ── x402 Skill Server tools ───────────────────────────────────────────────────

export async function fetchCreditScore(address: Address) {
  const { payAndFetch } = await import('./x402.js')
  return payAndFetch(`/credit-score?address=${address}`, agentAddress())
}

export async function fetchBorrowCapacity(address: Address) {
  const { payAndFetch } = await import('./x402.js')
  return payAndFetch(`/borrow-capacity?address=${address}`, agentAddress())
}

export async function fetchMarketRate() {
  const { payAndFetch } = await import('./x402.js')
  return payAndFetch('/market-rate', agentAddress())
}
