import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://xenith.com.co'

const title = 'Xenith Vector — Inventario RFID y CRM para empresas audiovisuales'
const description =
  'Inventario, CRM, cotizaciones, proyectos y calendario en una sola plataforma. Con lectores, antenas y tags RFID para que tu bodega se cuente sola. Lanzamiento: 1 de septiembre.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/vector` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/vector`,
    siteName: 'Xenith',
    locale: 'es_CO',
    type: 'website',
    images: [{ url: `${SITE_URL}/images/logo.png`, width: 800, height: 200, alt: 'Xenith Vector' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [`${SITE_URL}/images/logo.png`],
  },
}

export default function VectorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
