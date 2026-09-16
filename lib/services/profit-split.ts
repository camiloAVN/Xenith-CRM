import type { ContributionSettings } from '@/lib/services/contribution-settings.service'

/**
 * Reparto del dinero de un proyecto.
 *
 * El neto (ingresos recibidos − costos directos) NO se reparte entero por
 * puntos: se corta primero en tres capas, y solo la última se divide según el
 * aporte de cada quien.
 *
 *   empresa   caja, herramientas, impuestos, reinversión
 *   fundador  capital y tiempo invertidos antes de que existiera el sistema
 *   pozo      se reparte por puntos del ledger
 *
 * Las tres son parámetros (`companyRatio`, `founderRatio`), no números
 * escritos en el código: la capa del fundador está pensada para bajar a cero
 * cuando la empresa se sostenga sola y empiecen los salarios.
 *
 * Encima del pozo va un **tope individual**: nadie se lleva más de
 * `maxIndividualShare` del pozo de un proyecto. Lo que sobra por el tope se
 * reparte entre los demás, y si ya nadie puede recibirlo, se queda en la
 * reserva de la empresa (nunca se evapora ni rompe la suma).
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export interface SplitLayers {
  net: number
  company: number
  founder: number
  pool: number
}

/**
 * Corta el neto en las tres capas.
 *
 * La empresa se queda con el redondeo: es la única capa que no se le debe a
 * una persona, así que absorber ahí los centavos mantiene la suma exacta.
 */
export function splitLayers(net: number, settings: ContributionSettings): SplitLayers {
  const safeNet = round2(Math.max(0, net))
  const founder = round2(safeNet * settings.founderRatio)
  const pool = round2(safeNet * settings.poolRatio)
  return {
    net: safeNet,
    company: round2(safeNet - founder - pool),
    founder,
    pool,
  }
}

export interface PointsRow {
  userId: string
  points: number
}

export interface PoolShare {
  userId: string
  points: number
  /** Porcentaje del pozo, 0-100, ya con el tope aplicado. */
  percentage: number
  amount: number
  /** true si el tope individual le recortó la parte. */
  capped: boolean
}

export interface PoolSplit {
  totalPoints: number
  shares: PoolShare[]
  /** Parte del pozo que el tope dejó sin dueño; se suma a la reserva. */
  unassigned: number
}

/**
 * Reparte el pozo por puntos, aplicando el tope individual.
 *
 * El recorte se redistribuye entre quienes todavía están por debajo del tope,
 * en proporción a sus puntos, y se repite porque redistribuir puede empujar a
 * otro contra el tope. Con tres personas converge en una o dos vueltas; el
 * límite de iteraciones solo evita un ciclo infinito si alguien configura un
 * tope absurdo.
 */
export function splitPool(
  pool: number,
  rows: PointsRow[],
  maxIndividualShare: number
): PoolSplit {
  const positive = rows.filter((r) => r.points > 0)
  const totalPoints = round2(positive.reduce((sum, r) => sum + r.points, 0))

  if (pool <= 0 || totalPoints <= 0) {
    return {
      totalPoints,
      shares: rows.map((r) => ({
        userId: r.userId,
        points: r.points,
        percentage: 0,
        amount: 0,
        capped: false,
      })),
      unassigned: round2(Math.max(0, pool)),
    }
  }

  const cap = pool * maxIndividualShare
  const amounts = new Map<string, number>()
  const capped = new Set<string>()

  for (let round = 0; round < 10; round++) {
    const openRows = positive.filter((r) => !capped.has(r.userId))
    const openPoints = openRows.reduce((sum, r) => sum + r.points, 0)
    const assigned = [...capped].reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0)
    const remaining = pool - assigned

    if (openRows.length === 0 || openPoints <= 0 || remaining <= 0) break

    let newlyCapped = false
    for (const row of openRows) {
      const amount = (remaining * row.points) / openPoints
      if (amount > cap + 0.005) {
        amounts.set(row.userId, cap)
        capped.add(row.userId)
        newlyCapped = true
      } else {
        amounts.set(row.userId, amount)
      }
    }
    if (!newlyCapped) break
  }

  const shares: PoolShare[] = rows.map((r) => {
    const amount = round2(amounts.get(r.userId) ?? 0)
    return {
      userId: r.userId,
      points: r.points,
      percentage: pool > 0 ? round2((amount / pool) * 100) : 0,
      amount,
      capped: capped.has(r.userId),
    }
  })

  const distributed = shares.reduce((sum, s) => sum + s.amount, 0)
  return {
    totalPoints,
    shares,
    unassigned: round2(Math.max(0, pool - distributed)),
  }
}
