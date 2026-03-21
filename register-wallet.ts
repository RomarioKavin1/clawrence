import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Register Clawrence's agent identity on the ERC-8004 Identity Registry
 * on Celo Sepolia.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx register-wallet.ts
 */

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

const IDENTITY_REGISTRY = '0x16977D77168D6aB0Bc3b498d40bA4392B1f4e7e1' as const

// Minimal ERC-8004 Identity Registry ABI for registration
const IDENTITY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'setAgentURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [],
  },
] as const

async function main() {
  const privateKey = process.env.PRIVATE_KEY
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

  const metadataURI = JSON.stringify({
    name: 'Clawrence',
    description: 'Autonomous credit agent on Celo — deposit WETH, build reputation, borrow USDC.',
    x402Support: true,
    services: ['credit-score', 'borrow-capacity', 'market-rate'],
    network: 'Celo Sepolia',
    chainId: 11142220,
  })

  console.log('Registering Clawrence agent on ERC-8004 Identity Registry...')
  console.log('Registry:', IDENTITY_REGISTRY)
  console.log('Account:', account.address)

  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: 'registerAgent',
    args: [metadataURI],
  })

  console.log('Transaction hash:', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status)
  console.log('Block:', receipt.blockNumber.toString())
  console.log('Done. Check Celoscan:', `https://celo-sepolia.celoscan.io/tx/${hash}`)
}

main().catch(console.error)
