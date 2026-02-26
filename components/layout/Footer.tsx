'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Github, Linkedin, Twitter, Mail } from 'lucide-react'

// Importación dinámica — evita errores de hidratación SSR
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false, loading: () => null }
)

// ─── Archivo de animación ────────────────────────────────────────────────────
// Guarda tu animación en /public/footer-animation.lottie (o .json)
// y actualiza la ruta aquí si usas otro nombre de archivo.
const FOOTER_LOTTIE_SRC = '/animations/footer-animation.json'

export function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    company: [
      { label: 'Nosotros', href: '/inicio#nosotros' },
      { label: 'Soluciones', href: '/soluciones' },
      { label: 'Contacto', href: '/contacto' },
    ],
    legal: [
      { label: 'Privacidad', href: '#' },
      { label: 'Términos', href: '#' },
    ],
  }

  const socialLinks = [
    { icon: Github, href: '#', label: 'GitHub' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Mail, href: '/contacto', label: 'Email' },
  ]

  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/*
         * Grid responsive:
         *  mobile  → 1 columna  (todo apilado)
         *  sm      → 2 columnas (brand + anim | empresa | legal)
         *  lg      → 5 columnas (brand×2 | empresa | legal | animación)
         */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">

          {/* ── Brand ────────────────────────────────────────────────────────── */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex flex-col items-center sm:items-start text-center sm:text-left">
            <Link href="/inicio" className="inline-flex items-center group">
              <Image
                src="/images/xenith-logo.png"
                alt="XENITH"
                width={240}
                height={64}
                className="h-14 sm:h-16 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
              />
            </Link>
            <p className="text-gray-400 text-sm max-w-sm mt-4 leading-relaxed">
              Soluciones innovadoras en ingeniería robótica y desarrollo de software.
              Transformamos ideas en realidad tecnológica.
            </p>
          </div>

          {/* ── Empresa ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Empresa
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-violet-400 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Legal ────────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-violet-400 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Animación Lottie ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Innovación
            </h3>

            {/* Contenedor de la animación */}
            <div className="w-36 h-36">
              <DotLottieReact
                src={FOOTER_LOTTIE_SRC}
                loop
                autoplay
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-[160px]">
              Construyendo el futuro tecnológico juntos.
            </p>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-gray-500 text-sm">
            © {currentYear} XENITH. Todos los derechos reservados.
          </p>

          {/* Redes sociales */}
          <div className="flex items-center space-x-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                className="text-gray-500 hover:text-violet-400 transition-colors"
                aria-label={social.label}
                target={social.href.startsWith('http') ? '_blank' : undefined}
                rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
