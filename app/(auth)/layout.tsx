import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-between sm:justify-center gap-6 px-4 py-6 sm:p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Logo: en el flujo en móvil (no se monta sobre el recuadro), fijo arriba a la izquierda en escritorio */}
      <Link
        href="/inicio"
        className="shrink-0 flex items-center group sm:absolute sm:top-8 sm:left-8"
      >
        <Image
          src="/images/logo.png"
          alt="XENITH"
          width={420}
          height={110}
          className="h-12 sm:h-20 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
          priority
        />
      </Link>

      {/* Content */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Back to home link */}
      <Link
        href="/inicio"
        className="shrink-0 text-sm text-gray-400 hover:text-violet-400 transition-colors sm:absolute sm:bottom-8"
      >
        ← Volver al inicio
      </Link>
    </div>
  )
}
