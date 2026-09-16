import { NextRequest, NextResponse } from 'next/server'
import { botService } from '@/lib/services/bot.service'

/**
 * Pendientes de tareas para el bot de Telegram (n8n en Railway).
 *
 *   GET /api/v1/bot/pendientes                 -> todos los usuarios activos
 *   GET /api/v1/bot/pendientes?email=x         -> solo esa persona
 *   GET /api/v1/bot/pendientes?since=ISO       -> además, `novedades` desde esa fecha
 *
 * Autenticación: `Authorization: Bearer $BOT_API_TOKEN` (mismo patrón que
 * CRON_SECRET). Sin token configurado la ruta queda cerrada.
 */
export const dynamic = 'force-dynamic'

// Evita que un `since` viejo (bot caído varios días) dispare una avalancha de avisos
const MAX_SINCE_MS = 2 * 86_400_000

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.BOT_API_TOKEN
  if (!token) return false
  return request.headers.get('authorization') === `Bearer ${token}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim() || undefined
  const sinceRaw = searchParams.get('since')

  let since: Date | undefined
  if (sinceRaw) {
    const parsed = new Date(sinceRaw)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'since inválido' }, { status: 400 })
    }
    since = new Date(Math.max(parsed.getTime(), Date.now() - MAX_SINCE_MS))
  }

  try {
    const users = await botService.getPending({ email, since })
    return NextResponse.json({ now: new Date().toISOString(), since: since?.toISOString() ?? null, users })
  } catch (error) {
    console.error('Error en /api/v1/bot/pendientes:', error)
    return NextResponse.json({ error: 'Error al consultar pendientes' }, { status: 500 })
  }
}
