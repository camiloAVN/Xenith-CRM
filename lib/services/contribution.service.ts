import { prisma } from '@/lib/db/prisma'
import { getProjectMemberIds } from '@/lib/auth/permissions'
import { TaskPermissionError } from '@/lib/services/task.service'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { splitLayers, splitPool } from '@/lib/services/profit-split'

/**
 * Cálculo del porcentaje de aporte y del reparto.
 *
 *   % de un miembro = sus puntos efectivos aceptados
 *                     ÷ todos los puntos efectivos aceptados del proyecto
 *
 * La fuente es SIEMPRE el ledger, nunca las tareas. Dos razones:
 *
 *  - El ledger es append-only: una tarea reabierta tiene su crédito original
 *    más un asiento negativo, y la suma da el saldo correcto sin tocar nada.
 *  - Quien sale del proyecto conserva lo ganado. Si el cálculo partiera de
 *    `ProjectMember`, su aporte desaparecería y los porcentajes de los demás
 *    subirían solos — justo lo contrario de "lo ganado queda ganado".
 */

export interface MemberContribution {
  userId: string
  user: { id: string; name: string | null; email: string; image: string | null }
  /** Saldo neto en el ledger (créditos menos reversiones). */
  points: number
  /** Porcentaje sobre el total del proyecto, 0-100. */
  percentage: number
  /** Parte del pozo que le corresponde si se liquidara hoy, con el tope aplicado. */
  share: number
  /** true si el tope individual le recortó la parte. */
  capped: boolean
  /** false si ya no pertenece al proyecto pero conserva su saldo. */
  isCurrentMember: boolean
  entryCount: number
}

export interface ProjectContributions {
  projectId: string
  totalPoints: number
  /** Pozo repartible por puntos: la capa `poolRatio` de lo que falta liquidar. */
  pool: number
  /** Neto del proyecto: ingresos menos deducciones. */
  net: number
  /** Neto que todavía no se ha liquidado. */
  available: number
  /** Ya repartido en liquidaciones anteriores. */
  distributed: number
  /** Reserva de la empresa sobre lo disponible (incluye el sobrante del tope). */
  company: number
  /** Capa del fundador sobre lo disponible. */
  founder: number
  founderUserId: string | null
  maxIndividualShare: number
  income: number
  deductions: number
  members: MemberContribution[]
  /** Puntos ya valorados pero todavía sin aceptar: aún no reparten. */
  pendingPoints: number
  pendingTaskCount: number
}

/** Redondeo monetario/porcentual a 2 decimales. */
const round2 = (n: number) => Math.round(n * 100) / 100

export interface AdjustmentRow {
  id: string
  points: number
  note: string | null
  createdAt: Date
  user: { id: string; name: string | null; email: string }
  createdBy: { id: string; name: string | null; email: string } | null
}

export const contributionService = {
  /**
   * Asiento manual del dueño: puntos otorgados (o descontados) a discreción,
   * fuera del ciclo de tareas.
   *
   * Sirve para el back-fill de trabajo previo al sistema y para reconocer
   * aportes que no encajan en una tarea. Entra al MISMO ledger, así que mueve
   * los porcentajes igual que cualquier otro punto.
   *
   * Se permiten valores negativos: corregir un ajuste de más es agregar el
   * opuesto, nunca borrar el original — el ledger es append-only.
   */
  async createAdjustment(
    projectId: string,
    userId: string,
    points: number,
    note: string | null,
    actorId: string
  ) {
    if (!Number.isFinite(points) || points === 0) {
      throw new TaskPermissionError('Los puntos deben ser un número distinto de cero')
    }

    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!member) throw new TaskPermissionError('El usuario no existe')

    return prisma.pointLedgerEntry.create({
      data: {
        projectId,
        userId,
        type: 'ADJUSTMENT',
        points: Math.round(points * 100) / 100,
        note,
        createdById: actorId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
  },

  /** Ajustes manuales del proyecto, del más reciente al más antiguo. */
  async listAdjustments(projectId: string): Promise<AdjustmentRow[]> {
    const rows = await prisma.pointLedgerEntry.findMany({
      where: { projectId, type: 'ADJUSTMENT' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return rows.map((r) => ({
      id: r.id,
      points: Number(r.points),
      note: r.note,
      createdAt: r.createdAt,
      user: r.user,
      createdBy: r.createdBy,
    }))
  },

  async getProjectContributions(projectId: string): Promise<ProjectContributions> {
    const [ledgerByUser, income, deductions, currentMemberIds, pending, settings, previous, founder] =
      await Promise.all([
      prisma.pointLedgerEntry.groupBy({
        by: ['userId'],
        where: { projectId },
        _sum: { points: true },
        _count: { _all: true },
      }),
      prisma.earning.aggregate({
        where: { projectId, type: 'COMPANY_INCOME' },
        _sum: { amount: true },
      }),
      prisma.earning.aggregate({
        where: { projectId, type: 'DEDUCTION' },
        _sum: { amount: true },
      }),
      getProjectMemberIds(projectId),
      // Tareas ya valoradas que todavía no se aceptan: sus puntos existen pero
      // aún no entran al reparto.
      prisma.task.findMany({
        where: {
          projectId,
          valuationStatus: 'VALUED',
          completionStatus: { not: 'ACCEPTED' },
          pointsValue: { not: null },
        },
        select: { pointsValue: true },
      }),
      contributionSettingsService.resolve(projectId),
      prisma.payout.aggregate({ where: { projectId }, _sum: { netAmount: true } }),
      prisma.user.findFirst({
        where: { role: 'SUPERADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
    ])

    // Las deducciones se guardan en negativo; el módulo de ganancias las
    // presenta en positivo y resta. Se replica esa convención.
    const incomeTotal = Number(income._sum.amount ?? 0)
    const deductionTotal = Math.abs(Number(deductions._sum.amount ?? 0))
    const net = round2(incomeTotal - deductionTotal)
    const distributed = round2(Number(previous._sum.netAmount ?? 0))
    // Solo se muestra lo que falta por repartir: lo ya liquidado quedó
    // congelado en su propia foto y no se vuelve a calcular.
    const available = round2(Math.max(0, net - distributed))

    const rows = ledgerByUser.map((row) => ({
      userId: row.userId,
      points: round2(Number(row._sum.points ?? 0)),
      entryCount: row._count._all,
    }))

    const totalPoints = round2(rows.reduce((acc, r) => acc + r.points, 0))

    // El dinero se corta en capas ANTES de mirar los puntos, y el pozo lleva
    // encima el tope individual.
    const layers = splitLayers(available, settings)
    const split = splitPool(layers.pool, rows, settings.maxIndividualShare)
    const shareByUser = new Map(split.shares.map((s) => [s.userId, s]))

    const users = rows.length
      ? await prisma.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: { id: true, name: true, email: true, image: true },
        })
      : []
    const userById = new Map(users.map((u) => [u.id, u]))
    const memberSet = new Set(currentMemberIds)

    const members: MemberContribution[] = rows
      .map((row) => {
        // Con total 0 no hay reparto posible; evita dividir por cero.
        const percentage = totalPoints > 0 ? round2((row.points / totalPoints) * 100) : 0
        const cut = shareByUser.get(row.userId)
        return {
          userId: row.userId,
          user: userById.get(row.userId) ?? {
            id: row.userId,
            name: null,
            email: 'usuario eliminado',
            image: null,
          },
          points: row.points,
          percentage,
          share: cut?.amount ?? 0,
          capped: cut?.capped ?? false,
          isCurrentMember: memberSet.has(row.userId),
          entryCount: row.entryCount,
        }
      })
      .sort((a, b) => b.points - a.points)

    return {
      projectId,
      totalPoints,
      pool: layers.pool,
      net,
      available,
      distributed,
      // El sobrante que deja el tope individual se queda en la reserva.
      company: round2(layers.company + split.unassigned),
      founder: layers.founder,
      founderUserId: founder?.id ?? null,
      maxIndividualShare: settings.maxIndividualShare,
      income: round2(incomeTotal),
      deductions: round2(deductionTotal),
      members,
      pendingPoints: round2(
        pending.reduce((acc, t) => acc + Number(t.pointsValue ?? 0), 0)
      ),
      pendingTaskCount: pending.length,
    }
  },
}
