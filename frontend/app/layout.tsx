import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import { Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'

const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Clawrence — On-chain Credit Agent',
  description: 'Deposit collateral, build reputation, borrow USDC. Not the bank. Better.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} ${outfit.variable} font-sans bg-[#050505] text-gray-100 min-h-screen antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#050505] to-[#050505]`}>
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
