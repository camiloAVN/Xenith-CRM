import type { ReactNode } from 'react'
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google'
import './landing.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--x-space-grotesk',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--x-manrope',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--x-jetbrains-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  )
}
