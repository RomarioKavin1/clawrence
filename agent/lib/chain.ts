import { defineChain } from 'viem'

export const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.CELO_RPC || 'https://forno.celo-sepolia.celo-testnet.org'] },
  },
  blockExplorers: {
    default: { name: 'Celoscan', url: 'https://celo-sepolia.celoscan.io' },
  },
  testnet: true,
})
