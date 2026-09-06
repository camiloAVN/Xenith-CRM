import { NextRequest, NextResponse } from 'next/server'
import { taskValuationService } from '@/lib/services/task-valuation.service'

/**
 * Cierre programado de ventanas de votación vencidas.
 *
 * ATENCION: hoy NO hay ningún cron programado que llame esta ruta. El cierre
 * perezoso (al abrir el tablero de un proyecto) cubre la operación; esto queda
 * listo para engancharse cuando se decida la plataforma.
 *
 * Portable entre plataformas a propósito:
 *  - Vercel Cron llamaría esta URL mandando `Authorization: Bearer $CRON_SECRET`
 *    (se declara en vercel.json; el plan Hobby solo admite una corrida diaria).
 *  - Railway (o cualquier cron de sistema) puede llamarla igual con ese header,
 *    o saltarse el HTTP y correr `npm run cron:tick`, que ejecuta el MISMO
 *    servicio en proceso. La lógica vive en el servicio, no aquí.
 *
 * Es idempotente: correrlo de más no altera ninguna tarea ya liquidada.
 */
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // Sin secreto configurado el endpoint queda cerrado: es preferible que el
  // cron falle ruidosamente a dejarlo abierto a internet.
  if (!secret) return false

  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true

  // Alternativa para crons que no permiten cabeceras personalizadas.
  return request.headers.get('x-cron-secret') === secret
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settled = await taskValuationService.settleExpired()
    return NextResponse.json({
      ok: true,
      settled: settled.length,
      taskIds: settled,
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en el cron de cierre de votaciones:', error)
    return NextResponse.json({ error: 'Error al cerrar votaciones' }, { status: 500 })
  }
}

// Vercel Cron usa GET; POST queda disponible para crons externos.
export const GET = handle
export const POST = handle
