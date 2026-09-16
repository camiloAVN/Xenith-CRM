import { prisma } from '@/lib/db/prisma'
import { isOwner } from '@/lib/auth/permissions'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { splitLayers, splitPool, type PoolShare } from '@/lib/services/profit-split'

/**
 * Liquidaciones: el momento en que el dinero sale del proyecto.
 *
 * El porcentaje de aporte es **vivo** (cambia cada vez que se acepta una
 * tarea), pero un pago no puede serlo: si el mes entrante alguien suma 30
 * puntos no puede cambiar el reparto de una plata ya repartida. Por eso al
 * liquidar se **fotografían** los puntos y los porcentajes de ese día, y la
 * fila queda inmutable. La siguiente liquidación usa el ledger actualizado.
 *
 * Cada liquidación escribe además un `Earning` de tipo `USER_EARNING` por
 * persona, que es lo que ya lee el módulo de ganancias.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export interface PayoutPreview {
  /** Neto del proyecto: ingresos recibidos − deducciones. */
  net: number
  income: number
  deductions: number
  /** Ya repartido en liquidaciones anteriores. */
  distributed: number
  /** Neto que todavía no se ha liquidado. */
  available: number
  /** Las tres capas sobre lo disponible. */
  company: number
  founder: number
  pool: number
  founderRatio: number
  poolRatio: number
  maxIndividualShare: number
  founderUserId: string | null
  totalPoints: number
  /** Sobrante del pozo por el tope individual; se suma a la reserva. */
  unassigned: number
  shares: (PoolShare & {
    user: { id: string; name: string | null; email: string }
    /** Lo que recibe en total: su parte del pozo más la capa de fundador. */
    total: number
  })[]
}

async function getFounderId(): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return owner?.id ?? null
}

export const payoutService = {
  /**
   * Qué pasaría si se liquidara hoy lo que está sin repartir.
   *
   * Es el mismo cálculo que hace `create()`; tenerlo aparte deja que la
   * pantalla muestre exactamente lo que se va a escribir.
   */
  async preview(projectId: string, amount?: number): Promise<PayoutPreview> {
    const [settings, income, deductions, ledgerByUser, previous, founderUserId] =
      await Promise.all([
        contributionSettingsService.resolve(projectId),
        prisma.earning.aggregate({
          where: { projectId, type: 'COMPANY_INCOME' },
          _sum: { amount: true },
        }),
        prisma.earning.aggregate({
          where: { projectId, type: 'DEDUCTION' },
          _sum: { amount: true },
        }),
        prisma.pointLedgerEntry.groupBy({
          by: ['userId'],
          where: { projectId },
          _sum: { points: true },
        }),
        prisma.payout.aggregate({
          where: { projectId },
          _sum: { netAmount: true },
        }),
        getFounderId(),
      ])

    const incomeTotal = round2(Number(income._sum.amount ?? 0))
    // Las deducciones se guardan en negativo y el módulo de ganancias las
    // presenta en positivo: se replica esa convención.
    const deductionTotal = round2(Math.abs(Number(deductions._sum.amount ?? 0)))
    const net = round2(incomeTotal - deductionTotal)
    const distributed = round2(Number(previous._sum.netAmount ?? 0))
    const available = round2(Math.max(0, net - distributed))

    const target = amount != null ? round2(Math.min(Math.max(0, amount), available)) : available
    const layers = splitLayers(target, settings)

    const rows = ledgerByUser
      .map((row) => ({ userId: row.userId, points: round2(Number(row._sum.points ?? 0)) }))
      .sort((a, b) => b.points - a.points)

    const split = splitPool(layers.pool, rows, settings.maxIndividualShare)

    const users = rows.length
      ? await prisma.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userById = new Map(users.map((u) => [u.id, u]))

    return {
      net,
      income: incomeTotal,
      deductions: deductionTotal,
      distributed,
      available,
      company: round2(layers.company + split.unassigned),
      founder: layers.founder,
      pool: layers.pool,
      founderRatio: settings.founderRatio,
      poolRatio: settings.poolRatio,
      maxIndividualShare: settings.maxIndividualShare,
      founderUserId,
      totalPoints: split.totalPoints,
      unassigned: split.unassigned,
      shares: split.shares.map((s) => ({
        ...s,
        user: userById.get(s.userId) ?? { id: s.userId, name: null, email: 'usuario eliminado' },
        total: round2(s.amount + (s.userId === founderUserId ? layers.founder : 0)),
      })),
    }
  },

  /**
   * Liquida y congela. Solo el dueño.
   *
   * Todo va en una transacción: la foto (payout + shares) y los `USER_EARNING`
   * que la reflejan. Si algo falla, no queda medio reparto escrito.
   */
  async create(
    projectId: string,
    data: { description?: string; amount?: number },
    actorId: string
  ) {
    if (!(await isOwner(actorId))) {
      throw new TaskPermissionError('Solo el dueño puede liquidar un proyecto')
    }

    const preview = await this.preview(projectId, data.amount)
    if (preview.available <= 0) {
      throw new TaskPermissionError(
        'No hay dinero sin repartir en este proyecto. Registra primero el ingreso en Ganancias.'
      )
    }
    const target = round2(
      data.amount != null ? Math.min(Math.max(0, data.amount), preview.available) : preview.available
    )
    if (target <= 0) {
      throw new TaskPermissionError('El monto a liquidar debe ser mayor que cero')
    }
    if (preview.totalPoints <= 0) {
      throw new TaskPermissionError(
        'Nadie tiene puntos en este proyecto todavía: no hay cómo repartir el pozo'
      )
    }

    const description = data.description?.trim() || `Liquidación del ${new Date().toLocaleDateString('es-CO')}`
    const withAmount = preview.shares.filter((s) => s.amount > 0)

    return prisma.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: {
          projectId,
          description,
          netAmount: target,
          companyAmount: preview.company,
          founderAmount: preview.founder,
          poolAmount: preview.pool,
          founderRatio: preview.founderRatio,
          poolRatio: preview.poolRatio,
          founderUserId: preview.founderUserId,
          createdById: actorId,
          shares: {
            create: withAmount.map((s) => ({
              userId: s.userId,
              points: s.points,
              percentage: s.percentage,
              amount: s.amount,
              capped: s.capped,
            })),
          },
        },
        include: { shares: true },
      })

      // Lo que ya lee el módulo de ganancias. El fundador puede recibir dos
      // líneas: su parte del pozo y su capa, que son cosas distintas.
      const earnings = withAmount.map((s) => ({
        description: `${description} · reparto por aporte`,
        amount: s.amount,
        type: 'USER_EARNING' as const,
        projectId,
        userId: s.userId,
      }))
      if (preview.founder > 0 && preview.founderUserId) {
        earnings.push({
          description: `${description} · retorno del fundador`,
          amount: preview.founder,
          type: 'USER_EARNING' as const,
          projectId,
          userId: preview.founderUserId,
        })
      }
      if (earnings.length > 0) {
        await tx.earning.createMany({ data: earnings })
      }

      return payout
    })
  },

  /** Liquidaciones del proyecto, de la más reciente a la más vieja. */
  async list(projectId: string) {
    const payouts = await prisma.payout.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        shares: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { amount: 'desc' },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    return payouts.map((p) => ({
      id: p.id,
      description: p.description,
      createdAt: p.createdAt,
      netAmount: Number(p.netAmount),
      companyAmount: Number(p.companyAmount),
      founderAmount: Number(p.founderAmount),
      poolAmount: Number(p.poolAmount),
      founderUserId: p.founderUserId,
      createdBy: p.createdBy,
      shares: p.shares.map((s) => ({
        userId: s.userId,
        user: s.user,
        points: Number(s.points),
        percentage: Number(s.percentage),
        amount: Number(s.amount),
        capped: s.capped,
      })),
    }))
  },
}
