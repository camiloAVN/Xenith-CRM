import { prisma } from '@/lib/db/prisma'
import { getProjectMemberIds } from '@/lib/auth/permissions'

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
  /** Parte del pozo repartible que le corresponde. */
  share: number
  /** false si ya no pertenece al proyecto pero conserva su saldo. */
  isCurrentMember: boolean
  entryCount: number
}

export interface ProjectContributions {
  projectId: string
  totalPoints: number
  /** Pozo repartible: ingresos menos deducciones del proyecto. */
  pool: number
  income: number
  deductions: number
  members: MemberContribution[]
  /** Puntos ya valorados pero todavía sin aceptar: aún no reparten. */
  pendingPoints: number
  pendingTaskCount: number
}

/** Redondeo monetario/porcentual a 2 decimales. */
const round2 = (n: number) => Math.round(n * 100) / 100

export const contributionService = {
  async getProjectContributions(projectId: string): Promise<ProjectContributions> {
    const [ledgerByUser, income, deductions, currentMemberIds, pending] = await Promise.all([
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
    ])

    // Las deducciones se guardan en negativo; el módulo de ganancias las
    // presenta en positivo y resta. Se replica esa convención.
    const incomeTotal = Number(income._sum.amount ?? 0)
    const deductionTotal = Math.abs(Number(deductions._sum.amount ?? 0))
    const pool = round2(incomeTotal - deductionTotal)

    const rows = ledgerByUser.map((row) => ({
      userId: row.userId,
      points: round2(Number(row._sum.points ?? 0)),
      entryCount: row._count._all,
    }))

    const totalPoints = round2(rows.reduce((acc, r) => acc + r.points, 0))

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
          share: round2((pool * percentage) / 100),
          isCurrentMember: memberSet.has(row.userId),
          entryCount: row.entryCount,
        }
      })
      .sort((a, b) => b.points - a.points)

    return {
      projectId,
      totalPoints,
      pool,
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
