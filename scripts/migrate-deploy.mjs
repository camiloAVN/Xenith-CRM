import { spawnSync } from 'node:child_process'

/**
 * `prisma migrate deploy` con reintentos, solo para el tope de conexiones.
 *
 * La base es un Prisma Postgres y el rol de migraciones tiene MUY pocas
 * conexiones. Si alguien acaba de correr un script local contra producción, el
 * build de Vercel se topa con
 *
 *   FATAL: too many connections for role "prisma_migration"
 *
 * y el deploy se cae aunque no haya ninguna migración pendiente. Las conexiones
 * ociosas se liberan en minutos, así que reintentar arregla el caso real.
 *
 * Cualquier OTRO error se propaga tal cual y tumba el build a propósito: subir
 * código que espera columnas que no existen es peor que un deploy fallido.
 */

const MAX_ATTEMPTS = 4
const WAIT_MS = 20_000
const CONNECTION_ERROR = /too many connections|connection pool|Can't reach database server/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)

  if (result.status === 0) process.exit(0)

  const isConnectionIssue = CONNECTION_ERROR.test(output)
  if (!isConnectionIssue || attempt === MAX_ATTEMPTS) {
    console.error(
      isConnectionIssue
        ? `\n[migrate] La base siguió sin conexiones libres tras ${MAX_ATTEMPTS} intentos.`
        : '\n[migrate] Error de migración: no se reintenta.'
    )
    process.exit(result.status ?? 1)
  }

  console.warn(
    `\n[migrate] Sin conexiones libres (intento ${attempt}/${MAX_ATTEMPTS}). ` +
      `Reintento en ${WAIT_MS / 1000}s...`
  )
  await sleep(WAIT_MS)
}
