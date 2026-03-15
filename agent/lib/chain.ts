import { defineChain } from 'viem'

export const goatTestnet3 = defineChain({
  id: 48816,
  name: 'GOAT Testnet3',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.GOAT_RPC || 'https://rpc.testnet3.goat.network'] },
  },
  blockExplorers: {
    default: { name: 'GOAT Explorer', url: 'https://explorer.testnet3.goat.network' },
  },
  testnet: true,
})
