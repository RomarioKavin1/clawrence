import { createPublicClient, http } from 'viem'
import { celoSepolia } from './chain'

export const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(),
})
