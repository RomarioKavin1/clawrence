import { createPublicClient, http } from 'viem'
import { goatTestnet3 } from './chain'

export const publicClient = createPublicClient({
  chain: goatTestnet3,
  transport: http(),
})
