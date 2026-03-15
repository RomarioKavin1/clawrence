'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePathname } from 'next/navigation'

const links = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Vault', path: '/vault' },
  { name: 'Leaderboard', path: '/leaderboard' },
  { name: 'Identity', path: '/identity' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav style={{ backgroundColor: '#B8BFB0', position: 'sticky', top: 0, zIndex: 50, padding: '0.875rem 1.5rem' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Left: logo + links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '0.5rem',
              background: '#CAFF00', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '1rem', color: '#111', lineHeight: 1 }}>C</span>
            </div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#111', letterSpacing: '-0.02em' }}>
              CLAWRENCE
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {links.map(link => {
              const active = pathname === link.path
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  style={{
                    textDecoration: 'none',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    padding: '0.4rem 0.875rem',
                    borderRadius: 9999,
                    background: active ? '#111' : 'transparent',
                    color: active ? '#fff' : '#6B7260',
                    transition: 'all 0.15s',
                  }}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>
        </div>

        <ConnectButton showBalance={false} />
      </div>
    </nav>
  )
}
