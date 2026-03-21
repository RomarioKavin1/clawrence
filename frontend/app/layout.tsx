import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Clawrence — On-chain Credit Agent',
  description: 'Deposit WETH, build credit, borrow USDC. Not the bank. Better.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  )
}
