import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { celoSepolia } from './chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Clawrence',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [celoSepolia],
  transports: {
    [celoSepolia.id]: http(),
  },
  ssr: true,
})
