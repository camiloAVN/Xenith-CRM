import { prisma } from '@/lib/db/prisma'

/**
 * Métricas históricas de aporte por proyecto.
 *
 * Todo sale del ledger, igual que los porcentajes: es la única fuente que
 * refleja reversiones y conserva el saldo de quien ya salió del equipo.
 */

/**
 * Los meses se agrupan en hora de Bogotá, no en UTC. Un asiento creado a las
 * 21:00 del 31 de enero (02:00 UTC del 1 de febrero) pertenece a enero para el
 * equipo; agrupar en UTC lo correría de mes.
 */
const TIMEZONE = 'America/Bogota'

const monthKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
})

/** 'YYYY-MM' en hora local del equipo. */
function monthKey(date: Date): string {
  // en-CA da 'YYYY-MM-DD'; basta con el prefijo.
  return monthKeyFmt.format(date).slice(0, 7)
}

/** Todos los meses entre dos extremos, incluidos los vacíos. */
function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'insufficient'

export interface MemberMetrics {
  userId: string
  user: { id: string; name: string | null; email: string; image: string | null }
  totalPoints: number
  percentage: number
  /** Puntos por mes, alineado con `months`. */
  monthly: number[]
  /** Mes con más puntos acreditados. */
  bestMonth: { month: string; points: number } | null
  /** Promedio mensual sobre los meses en los que aportó algo. */
  activeMonthAvg: number
  trend: {
    /** Promedio de los últimos 3 meses. */
    recentAvg: number
    /** Promedio de los 3 meses anteriores a esos. */
    previousAvg: number
    /** Variación porcentual entre ambos; null si no hay base de comparación. */
    changePct: number | null
    direction: TrendDirection
  }
  /** Tareas aceptadas (asientos de crédito, sin contar reversiones). */
  acceptedTasks: number
}

export interface ProjectMetrics {
  projectId: string
  months: string[]
  totalPoints: number
  /** Total del proyecto por mes, alineado con `months`. */
  projectMonthly: number[]
  /** Mes más productivo del proyecto entero. */
  bestMonth: { month: string; points: number } | null
  members: MemberMetrics[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Ventana de comparación de rendimiento, en meses. */
const TREND_WINDOW = 3
/** Variación por debajo de la cual se considera que el ritmo se mantuvo. */
const FLAT_THRESHOLD_PCT = 10

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function buildTrend(monthly: number[]): MemberMetrics['trend'] {
  // La antiguedad se mide desde el PRIMER aporte de la persona, no desde el
  // inicio del proyecto. Con el largo del proyecto, quien entro el mes pasado
  // se comparaba contra una ventana previa de ceros y salia marcado como
  // "subiendo" — un elogio inventado a partir de no tener historia.
  const firstActive = monthly.findIndex((p) => p > 0)
  const activeSpan = firstActive === -1 ? 0 : monthly.length - firstActive

  if (activeSpan < TREND_WINDOW * 2) {
    return { recentAvg: 0, previousAvg: 0, changePct: null, direction: 'insufficient' }
  }

  const recent = monthly.slice(-TREND_WINDOW)
  const previous = monthly.slice(-TREND_WINDOW * 2, -TREND_WINDOW)

  const recentAvg = round2(average(recent))
  const previousAvg = round2(average(previous))

  if (previousAvg === 0) {
    // Antes no aportaba nada: cualquier punto es subida, cero es "sin datos".
    return {
      recentAvg,
      previousAvg,
      changePct: null,
      direction: recentAvg > 0 ? 'up' : 'insufficient',
    }
  }

  const changePct = round2(((recentAvg - previousAvg) / previousAvg) * 100)
  const direction: TrendDirection =
    changePct > FLAT_THRESHOLD_PCT ? 'up' : changePct < -FLAT_THRESHOLD_PCT ? 'down' : 'flat'

  return { recentAvg, previousAvg, changePct, direction }
}

export const contributionMetricsService = {
  async getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
    const entries = await prisma.pointLedgerEntry.findMany({
      where: { projectId },
      select: { userId: true, points: true, type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    if (entries.length === 0) {
      return {
        projectId,
        months: [],
        totalPoints: 0,
        projectMonthly: [],
        bestMonth: null,
        members: [],
      }
    }

    // El rango llega siempre hasta el mes actual: si el equipo lleva dos meses
    // sin acreditar nada, esos ceros son justamente la señal a mostrar.
    const months = monthRange(
      monthKey(entries[0].createdAt),
      monthKey(new Date())
    )
    const monthIndex = new Map(months.map((m, i) => [m, i]))

    const byUser = new Map<
      string,
      { monthly: number[]; total: number; acceptedTasks: number }
    >()
    const projectMonthly = new Array(months.length).fill(0)

    for (const entry of entries) {
      const idx = monthIndex.get(monthKey(entry.createdAt))
      if (idx === undefined) continue

      const points = Number(entry.points)
      let row = byUser.get(entry.userId)
      if (!row) {
        row = { monthly: new Array(months.length).fill(0), total: 0, acceptedTasks: 0 }
        byUser.set(entry.userId, row)
      }

      row.monthly[idx] += points
      row.total += points
      if (entry.type === 'TASK_ACCEPTED' || entry.type === 'SEED') row.acceptedTasks++
      projectMonthly[idx] += points
    }

    const totalPoints = round2(
      [...byUser.values()].reduce((acc, r) => acc + r.total, 0)
    )

    const users = await prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: { id: true, name: true, email: true, image: true },
    })
    const userById = new Map(users.map((u) => [u.id, u]))

    const members: MemberMetrics[] = [...byUser.entries()]
      .map(([userId, row]) => {
        const monthly = row.monthly.map(round2)

        let bestMonth: MemberMetrics['bestMonth'] = null
        monthly.forEach((points, i) => {
          if (points > 0 && (!bestMonth || points > bestMonth.points)) {
            bestMonth = { month: months[i], points }
          }
        })

        const activeMonths = monthly.filter((p) => p > 0)

        return {
          userId,
          user: userById.get(userId) ?? {
            id: userId,
            name: null,
            email: 'usuario eliminado',
            image: null,
          },
          totalPoints: round2(row.total),
          percentage: totalPoints > 0 ? round2((row.total / totalPoints) * 100) : 0,
          monthly,
          bestMonth,
          activeMonthAvg: round2(average(activeMonths)),
          trend: buildTrend(monthly),
          acceptedTasks: row.acceptedTasks,
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)

    let bestMonth: ProjectMetrics['bestMonth'] = null
    projectMonthly.forEach((points, i) => {
      if (points > 0 && (!bestMonth || points > bestMonth.points)) {
        bestMonth = { month: months[i], points: round2(points) }
      }
    })

    return {
      projectId,
      months,
      totalPoints,
      projectMonthly: projectMonthly.map(round2),
      bestMonth,
      members,
    }
  },
}
