import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { goatTestnet3 } from './chain.js'

export const publicClient = createPublicClient({
  chain: goatTestnet3,
  transport: http(),
})

export function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return {
    client: createWalletClient({ account, chain: goatTestnet3, transport: http() }),
    account,
  }
}
