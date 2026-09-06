/**
 * Tick del cron en proceso, para plataformas cuyo scheduler ejecuta comandos
 * en vez de llamar URLs (Railway, un cron de sistema, un contenedor aparte).
 *
 * Ejecuta exactamente el mismo servicio que el endpoint HTTP
 * `/api/v1/cron/close-voting`, así que ambos caminos no pueden divergir.
 *
 *   npm run cron:tick
 */
import { taskValuationService } from '../lib/services/task-valuation.service'
import { prisma } from '../lib/db/prisma'

async function main() {
  const startedAt = Date.now()
  const settled = await taskValuationService.settleExpired()

  console.info(
    `[cron] ${settled.length} votacion(es) cerrada(s) en ${Date.now() - startedAt}ms`
  )
  if (settled.length > 0) console.info(`[cron] tareas: ${settled.join(', ')}`)
}

main()
  .catch((error) => {
    console.error('[cron] fallo:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
