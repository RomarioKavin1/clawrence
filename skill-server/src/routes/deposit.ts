import { Router, Request, Response } from 'express'
import { parseEther, formatEther, type Address } from 'viem'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { publicClient } from '../lib/client'
import { VAULT_ABI, ERC20_ABI } from '../lib/abis'
import { celoSepolia } from '../lib/chain'

const router = Router()

const WETH_ADDRESS = process.env.WETH_ADDRESS as Address
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as Address
const SERVER_WALLET = process.env.SERVER_WALLET_ADDRESS as Address
const PK = process.env.PRIVATE_KEY as `0x${string}`

// Track consumed tx hashes to prevent replay
const consumedTxHashes = new Set<string>()

const APPROVE_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const TRANSFER_EVENT_ABI = [{
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ],
}] as const

router.post('/', async (req: Request, res: Response) => {
  const fromAddress = req.headers['x-from-address'] as string | undefined
  const txHash = req.headers['x-tx-hash'] as string | undefined
  const amountStr = req.query.amount as string

  if (!fromAddress) {
    res.status(400).json({ error: 'Missing X-From-Address header' })
    return
  }
  if (!amountStr || isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
    res.status(400).json({ error: 'Missing or invalid amount query param' })
    return
  }

  const amountWei = parseEther(amountStr)

  // No tx hash → return 402 with payment instructions
  if (!txHash) {
    res.status(402).json({
      error: 'Payment required',
      token: 'WETH',
      tokenContract: WETH_ADDRESS,
      payTo: SERVER_WALLET,
      amount: amountStr,
      amountWei: amountWei.toString(),
      chainId: 11142220,
      instructions: `Approve and transfer ${amountStr} WETH to ${SERVER_WALLET}, then retry with X-Tx-Hash header`,
    })
    return
  }

  // Has tx hash → verify and deposit
  if (consumedTxHashes.has(txHash.toLowerCase())) {
    res.status(400).json({ error: 'Transaction hash already consumed' })
    return
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })

    if (receipt.status !== 'success') {
      res.status(400).json({ error: 'Transaction failed on-chain' })
      return
    }

    // Find WETH Transfer event: from=user, to=serverWallet
    let transferAmount = 0n
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== WETH_ADDRESS.toLowerCase()) continue
      if (log.topics.length < 3) continue
      // Transfer(address indexed from, address indexed to, uint256 value)
      const from = '0x' + log.topics[1]!.slice(26)
      const to = '0x' + log.topics[2]!.slice(26)
      if (from.toLowerCase() === fromAddress.toLowerCase() && to.toLowerCase() === SERVER_WALLET.toLowerCase()) {
        transferAmount = BigInt(log.data)
      }
    }

    if (transferAmount === 0n) {
      res.status(400).json({ error: 'No matching WETH transfer found in transaction' })
      return
    }

    if (transferAmount < amountWei) {
      res.status(400).json({
        error: 'Transfer amount insufficient',
        expected: amountWei.toString(),
        received: transferAmount.toString(),
      })
      return
    }

    consumedTxHashes.add(txHash.toLowerCase())

    // Now deposit into vault on behalf of the user
    const account = privateKeyToAccount(PK)
    const walletClient = createWalletClient({
      account,
      chain: celoSepolia,
      transport: http(),
    })

    // Approve WETH to vault
    const approveTx = await walletClient.writeContract({
      address: WETH_ADDRESS,
      abi: APPROVE_ABI,
      functionName: 'approve',
      args: [VAULT_ADDRESS, transferAmount],
      account,
      chain: celoSepolia,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })

    // Call depositFor
    const depositTx = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'depositFor',
      args: [fromAddress as Address, transferAmount],
      account,
      chain: celoSepolia,
    })
    await publicClient.waitForTransactionReceipt({ hash: depositTx })

    // Read updated collateral
    const collateral = await publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'collateral',
      args: [fromAddress as Address],
    })

    res.json({
      status: 'deposited',
      user: fromAddress,
      amount: formatEther(transferAmount),
      amountWei: transferAmount.toString(),
      depositTxHash: depositTx,
      totalCollateral: formatEther(collateral as bigint),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[deposit] Error:', msg)
    res.status(500).json({ error: 'Deposit failed', detail: msg })
  }
})

export default router
