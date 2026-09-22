import { PrismaClient } from '@prisma/client'

/**
 * Cliente de Prisma preparado para serverless.
 *
 * La base es un Prisma Postgres remoto cuyo rol tiene MUY pocas conexiones.
 * En Vercel cada instancia de función abre su propio pool, así que dos
 * personas usando el tablero al tiempo bastaban para agotarlo y tumbar la
 * app con `FATAL: too many connections`. Tres defensas, en orden:
 *
 *  1. `connection_limit=1` → cada instancia sostiene UNA conexión, no nueve
 *     (el default de Prisma es núcleos × 2 + 1).
 *  2. El cliente se guarda en `globalThis` SIEMPRE —también en producción—
 *     para que un módulo recargado no abra un pool nuevo.
 *  3. Si aun así la conexión no se consigue, se reintenta con espera en vez
 *     de reventar la petición.
 */

/**
 * Añade los parámetros de pool a la URL. No toca las URLs de Prisma
 * Accelerate (`prisma+postgres://`): ahí el pool lo maneja el servicio.
 */
function withPoolParams(raw: string | undefined): string | undefined {
  if (!raw || !raw.startsWith('postgres')) return raw
  try {
    const url = new URL(raw)
    // `connection_limit=1` es lo correcto en serverless: la concurrencia se
    // resuelve con más instancias, no con más conexiones por instancia.
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1')
    // Cuánto espera una consulta por una conexión libre antes de fallar.
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20')
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '10')
    return url.toString()
  } catch {
    return raw
  }
}

/**
 * Errores en los que la consulta NUNCA llegó a ejecutarse: no se consiguió
 * conexión. Reintentarlos es seguro incluso si era una escritura, y en la API
 * se traducen a 503 ("vuelve a intentar"), no a un 500 que parece un bug.
 */
export function isDbSaturationError(error: unknown): boolean {
  const e = error as { code?: string; message?: string }
  if (e?.code === 'P2024' || e?.code === 'P1001' || e?.code === 'P1017') return true
  const msg = e?.message ?? ''
  return (
    msg.includes('too many connections') ||
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('Can\'t reach database server')
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: withPoolParams(process.env.DATABASE_URL),
  })

  // Reintento en UN solo sitio: cubre todas las consultas de la app sin que
  // cada servicio tenga que acordarse. Solo ante saturación de conexiones.
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const delays = [150, 500, 1200]
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args)
          } catch (error) {
            if (attempt >= delays.length || !isDbSaturationError(error)) throw error
            await sleep(delays[attempt] + Math.random() * 100)
          }
        }
      },
    },
  })
}

type ExtendedPrismaClient = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createClient()

// Se cachea también en producción: en serverless el módulo puede reevaluarse
// y cada cliente nuevo sería otro pool contra un rol que casi no tiene cupo.
globalForPrisma.prisma = prisma
