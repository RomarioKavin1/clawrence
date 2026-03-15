import { formatUnits, parseEther, parseUnits, type Address } from 'viem'
import { publicClient, getWalletClient } from '../lib/client.js'
import { VAULT_ABI, CREDIT_SCORE_ABI, ERC20_ABI } from '../lib/abis.js'

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

export async function borrowUSDC(amountUsdc: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseUnits(amountUsdc, 6)
  const hash = await client.writeContract({
    address: VAULT, abi: VAULT_ABI, functionName: 'borrow',
    args: [amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountUsdc} USDC` }
}

export async function repayUSDC(amountUsdc: string) {
  const { client, account } = getWalletClient(PK)
  const amount = parseUnits(amountUsdc, 6)

  // Approve USDC first if needed
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
    args: [amount], account, chain: client.chain,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, amount: `${amountUsdc} USDC` }
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
