import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { goatTestnet3 } from './chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Clawrence',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [goatTestnet3],
  transports: {
    [goatTestnet3.id]: http(),
  },
  ssr: true,
})
