import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celoSepolia } from './chain.js'

export const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(),
})

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return {
    client: createWalletClient({ account, chain: celoSepolia, transport: http() }),
    account,
  }
}
