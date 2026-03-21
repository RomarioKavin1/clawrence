import { parseEther, verifyTypedData, type Address } from 'viem'
import { publicClient, getWalletClient } from '../lib/client.js'
import { VAULT_ABI } from '../lib/abis.js'

const VAULT    = process.env.VAULT_ADDRESS as Address
const PK       = process.env.PRIVATE_KEY   as `0x${string}`
// ── EIP-712 Withdraw Challenge ──────────────────────────────────────────────

const EIP712_DOMAIN = {
  name: 'Clawrence',
  version: '1',
  chainId: 11142220,
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
  const expiresAt = nonce + 5 * 60 * 1000
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

  return verifyTypedData({
    address,
    domain: challenge.domain,
    types: challenge.types,
    primaryType: 'Withdraw',
    message: challenge.message,
    signature,
  })
}

export function consumeWithdrawChallenge(address: Address): WithdrawChallenge | undefined {
  const key = address.toLowerCase()
  const c = pendingWithdrawChallenges.get(key)
  pendingWithdrawChallenges.delete(key)
  return c
}

// ── Write tools (server-side execution) ──────────────────────────────────────

export async function withdrawWETH(amountEther: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseEther(amountEther)
  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'withdraw',
    args: [amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountEther} WETH` }
}

export function agentAddress(): Address {
  const { account } = getWalletClient(PK)
  return account.address
}
