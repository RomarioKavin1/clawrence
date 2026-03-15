'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const pathname = usePathname()
  
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl px-4 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(52,211,153,0.3)] group-hover:shadow-[0_0_25px_rgba(52,211,153,0.6)] transition-shadow duration-300">
              C
            </div>
            <span className="font-mono font-bold text-white text-xl tracking-tight">CLAWRENCE</span>
          </Link>
          <div className="hidden md:flex gap-1 items-center bg-white/5 rounded-full px-1 py-1 border border-white/5">
            {[
              { name: 'Dashboard', path: '/' },
              { name: 'Vault', path: '/vault' },
              { name: 'Leaderboard', path: '/leaderboard' },
              { name: 'Identity', path: '/identity' }
            ].map((link) => (
              <Link 
                key={link.path} 
                href={link.path} 
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  pathname === link.path 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </div>
    </nav>
  )
}
