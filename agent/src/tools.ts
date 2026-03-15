import { formatUnits, parseEther, parseUnits, verifyTypedData, type Address } from 'viem'
import { publicClient, getWalletClient } from '../lib/client.js'
import { VAULT_ABI, CREDIT_SCORE_ABI, ERC20_ABI } from '../lib/abis.js'

const VAULT    = process.env.VAULT_ADDRESS        as Address
const CS       = process.env.CREDIT_SCORE_ADDRESS as Address
const USDC     = process.env.USDC_ADDRESS         as Address
const PK       = process.env.PRIVATE_KEY          as `0x${string}`

// ── EIP-712 Withdraw Challenge ──────────────────────────────────────────────

const EIP712_DOMAIN = {
  name: 'Clawrence',
  version: '1',
  chainId: 48816,
  verifyingContract: VAULT,
} as const

const WITHDRAW_TYPES = {
  Withdraw: [
    { name: 'owner', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

interface WithdrawChallenge {
  domain: typeof EIP712_DOMAIN
  types: typeof WITHDRAW_TYPES
  message: { owner: Address; amount: string; nonce: string; deadline: string }
  amount: string
  expiresAt: number
}

const pendingWithdrawChallenges = new Map<string, WithdrawChallenge>()

export function generateWithdrawChallenge(address: Address, amountBtc: string): WithdrawChallenge {
  const nonce = Date.now()
  const expiresAt = nonce + 5 * 60 * 1000 // 5 minutes
  const amountWei = parseEther(amountBtc)

  const challenge: WithdrawChallenge = {
    domain: EIP712_DOMAIN,
    types: WITHDRAW_TYPES,
    message: {
      owner: address,
      amount: amountWei.toString(),
      nonce: nonce.toString(),
      deadline: expiresAt.toString(),
    },
    amount: amountBtc,
    expiresAt,
  }

  pendingWithdrawChallenges.set(address.toLowerCase(), challenge)
  return challenge
}

export async function verifyWithdrawSignature(address: Address, signature: `0x${string}`): Promise<boolean> {
  const key = address.toLowerCase()
  const challenge = pendingWithdrawChallenges.get(key)
  if (!challenge) return false
  if (Date.now() > challenge.expiresAt) {
    pendingWithdrawChallenges.delete(key)
    return false
  }

  const valid = await verifyTypedData({
    address,
    domain: challenge.domain,
    types: challenge.types,
    primaryType: 'Withdraw',
    message: challenge.message,
    signature,
  })

  return valid
}

export function consumeWithdrawChallenge(address: Address): WithdrawChallenge | undefined {
  const key = address.toLowerCase()
  const c = pendingWithdrawChallenges.get(key)
  pendingWithdrawChallenges.delete(key)
  return c
}

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

// ── Write tools (server-side execution) ──────────────────────────────────────

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
