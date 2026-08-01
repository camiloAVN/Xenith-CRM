import type { NextRequest } from 'next/server'

/**
 * IP del cliente a partir de las cabeceras del proxy.
 *
 * Detrás de Vercel, `x-forwarded-for` es una lista "cliente, proxy1, proxy2";
 * el primer valor es el cliente real. Solo es confiable porque Vercel
 * reescribe la cabecera en el borde — sin un proxy de confianza delante,
 * un atacante podría falsificarla.
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()

  return 'unknown'
}
