'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = [
    { href: '/inicio', label: 'Inicio' },
    { href: '/soluciones', label: 'Soluciones' },
    { href: '/contacto', label: 'Contacto' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <Link href="/inicio" className="flex items-center group">
            <Image
              src="/images/logo.png"
              alt="XENITH"
              width={220}
              height={56}
              className="h-14 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Login Button */}
          <div className="hidden md:block">
            <Link href="/login">
              <Button variant="primary" size="sm" className="hover-glow">
                Iniciar Sesión
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-800/50 bg-gray-900/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive(link.href)
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2">
              <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                <Button variant="primary" size="md" className="w-full">
                  Iniciar Sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
