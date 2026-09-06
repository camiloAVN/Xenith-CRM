import { prisma } from '@/lib/db/prisma'
import { getProjectPermissions } from '@/lib/auth/permissions'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { getRequiredApproverIds, canReviewCompletion } from '@/lib/services/task-lifecycle'
import { computePenalty, totalLateDays } from '@/lib/services/task-penalty'
import { TaskPermissionError } from '@/lib/services/task.service'
import { notificationService } from '@/lib/services/notification.service'

/**
 * Cumplimiento: aprobación por los jefes y acreditación de puntos.
 *
 * Una tarea se acepta cuando se cumplen DOS condiciones independientes:
 *   1. Todos los jefes requeridos (los del proyecto menos el asignado)
 *      aprobaron en la ronda actual.
 *   2. La valoración ya cerró y hay un valor en puntos fijado.
 *
 * Por eso la finalización se intenta desde dos lados: al registrarse la última
 * aprobación, y al cerrarse la ventana de votación. Lo que ocurra de último
 * dispara la aceptación. Sin esto, una tarea terminada y aprobada en 2 horas
 * se aceptaría antes de que el equipo alcance a votar y se acreditaría con el
 * mínimo del rango.
 */

export interface ApprovalStateDTO {
  completionStatus: 'PENDING' | 'SUBMITTED' | 'ACCEPTED'
  completionRound: number
  requiredApproverIds: string[]
  approvals: Array<{
    userId: string
    approved: boolean
    comment: string | null
    createdAt: Date
    user: { id: string; name: string | null; email: string; image: string | null }
  }>
  approvedCount: number
  /** true si falta que cierre la votación para poder acreditar. */
  waitingForValuation: boolean
  canReview: boolean
  reason: string | null
  pointsValue: number | null
  effectivePoints: number | null
  submittedAt: Date | null
  acceptedAt: Date | null
}

const taskSelect = {
  id: true,
  projectId: true,
  assignedTo: true,
  valuationStatus: true,
  completionStatus: true,
  completionRound: true,
  pointsValue: true,
  effectivePoints: true,
  submittedAt: true,
  acceptedAt: true,
  dueDate: true,
  lateAccruedDays: true,
  lateClockStartedAt: true,
} as const

export const taskCompletionService = {
  /**
   * Un jefe aprueba o rechaza. El rechazo devuelve la tarea a "en progreso",
   * abre una ronda nueva (las aprobaciones anteriores dejan de contar) y
   * reanuda el reloj de retraso desde este momento.
   */
  async review(
    taskId: string,
    currentUserId: string,
    approved: boolean,
    comment?: string | null
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskSelect })
    if (!task) throw new Error('Tarea no encontrada')

    const required = await getRequiredApproverIds(task.projectId, task.assignedTo)
    const check = canReviewCompletion(task, currentUserId, required)
    if (!check.ok) throw new TaskPermissionError(check.reason as string)

    await prisma.taskCompletionApproval.upsert({
      where: {
        taskId_userId_round: { taskId, userId: currentUserId, round: task.completionRound },
      },
      create: {
        taskId,
        userId: currentUserId,
        round: task.completionRound,
        approved,
        comment: comment ?? null,
      },
      update: { approved, comment: comment ?? null },
    })

    if (!approved) {
      const now = new Date()
      await prisma.task.update({
        where: { id: taskId },
        data: {
          completionStatus: 'PENDING',
          completionRound: { increment: 1 },
          submittedAt: null,
          lastRejectedAt: now,
          // El reloj vuelve a correr desde el rechazo.
          lateClockStartedAt: now,
        },
      })

      await prisma.taskHistory
        .create({
          data: {
            taskId,
            userId: currentUserId,
            field: 'completion_status',
            oldValue: 'SUBMITTED',
            newValue: 'REJECTED',
          },
        })
        .catch(console.error)

      void notificationService.completionRejected(taskId, currentUserId, comment)

      return { accepted: false, rejected: true }
    }

    const accepted = await this.tryFinalizeAcceptance(taskId, currentUserId)
    return { accepted, rejected: false }
  },

  /**
   * Acepta la tarea si ya se cumplen las dos condiciones. Idempotente y seguro
   * ante concurrencia: el `updateMany` con guarda de estado hace que solo una
   * llamada escriba, y el asiento del ledger va en la misma transacción.
   */
  async tryFinalizeAcceptance(taskId: string, actorId?: string): Promise<boolean> {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskSelect })
    if (!task || task.completionStatus !== 'SUBMITTED') return false
    if (!task.assignedTo) return false

    // Condición 2: la valoración tiene que estar cerrada.
    if (task.valuationStatus !== 'VALUED' || task.pointsValue == null) return false

    // Condición 1: todos los jefes requeridos aprobaron en la ronda actual.
    const required = await getRequiredApproverIds(task.projectId, task.assignedTo)
    if (required.length === 0) return false

    const approvals = await prisma.taskCompletionApproval.findMany({
      where: { taskId, round: task.completionRound, approved: true },
      select: { userId: true },
    })
    const approvedBy = new Set(approvals.map((a) => a.userId))
    if (!required.every((id) => approvedBy.has(id))) return false

    const settings = await contributionSettingsService.resolve(task.projectId)
    const now = new Date()
    const lateDays = totalLateDays({
      dueDate: task.dueDate,
      lateAccruedDays: Number(task.lateAccruedDays),
      lateClockStartedAt: task.lateClockStartedAt,
      now,
    })
    const penalty = computePenalty(Number(task.pointsValue), lateDays, settings)
    const note =
      penalty.penalty > 0
        ? `Valor ${Number(task.pointsValue)} menos ${penalty.penalty} por ${penalty.fullDaysLate} dia(s) de retraso`
        : null

    await prisma.$transaction(async (tx) => {
      const written = await tx.task.updateMany({
        where: { id: taskId, completionStatus: 'SUBMITTED' },
        data: {
          completionStatus: 'ACCEPTED',
          acceptedAt: now,
          effectivePoints: penalty.effectivePoints,
          lateAccruedDays: lateDays,
          lateClockStartedAt: null,
        },
      })
      // Otra llamada concurrente ya la aceptó: no duplicar el asiento.
      if (written.count === 0) return

      await tx.pointLedgerEntry.create({
        data: {
          projectId: task.projectId,
          userId: task.assignedTo as string,
          taskId,
          type: 'TASK_ACCEPTED',
          points: penalty.effectivePoints,
          note,
          createdById: actorId ?? null,
        },
      })
    })

    await prisma.taskHistory
      .create({
        data: {
          taskId,
          userId: actorId ?? (task.assignedTo as string),
          field: 'completion_status',
          oldValue: 'SUBMITTED',
          newValue: 'ACCEPTED',
        },
      })
      .catch(console.error)

    void notificationService.completionAccepted(taskId)

    return true
  },

  /**
   * Reabre una tarea ya aceptada. El crédito NO se borra: se escribe un asiento
   * negativo TASK_REVERTED, de modo que el ledger sigue siendo append-only y la
   * reversión queda auditable.
   */
  async reopen(taskId: string, currentUserId: string, reason?: string | null) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskSelect })
    if (!task) throw new Error('Tarea no encontrada')

    const perms = await getProjectPermissions(task.projectId, currentUserId)
    if (!perms.canManageTasks) {
      throw new TaskPermissionError('Solo los jefes del proyecto pueden reabrir una tarea')
    }
    if (task.completionStatus !== 'ACCEPTED') {
      throw new TaskPermissionError('Solo se puede reabrir una tarea aceptada')
    }

    // Saldo vivo de la tarea en el ledger: si ya hubo reversiones previas, la
    // suma incluye sus negativos y no se revierte de más.
    const credited = await prisma.pointLedgerEntry.aggregate({
      where: { taskId, userId: task.assignedTo as string },
      _sum: { points: true },
    })
    const outstanding = Number(credited._sum.points ?? 0)
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const written = await tx.task.updateMany({
        where: { id: taskId, completionStatus: 'ACCEPTED' },
        data: {
          completionStatus: 'PENDING',
          completionRound: { increment: 1 },
          acceptedAt: null,
          submittedAt: null,
          effectivePoints: null,
          // El reloj de retraso vuelve a correr desde la reapertura.
          lateClockStartedAt: now,
        },
      })
      if (written.count === 0) return

      if (outstanding !== 0) {
        await tx.pointLedgerEntry.create({
          data: {
            projectId: task.projectId,
            userId: task.assignedTo as string,
            taskId,
            type: 'TASK_REVERTED',
            points: -outstanding,
            note: reason || 'Tarea reabierta despues de haber sido aceptada',
            createdById: currentUserId,
          },
        })
      }
    })

    return { reverted: outstanding }
  },

  /** Estado de aprobación tal como lo consume el panel. */
  async getApprovalState(taskId: string, currentUserId: string): Promise<ApprovalStateDTO> {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: taskSelect })
    if (!task) throw new Error('Tarea no encontrada')

    const required = await getRequiredApproverIds(task.projectId, task.assignedTo)
    const approvals = await prisma.taskCompletionApproval.findMany({
      where: { taskId, round: task.completionRound },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const check = canReviewCompletion(task, currentUserId, required)

    return {
      completionStatus: task.completionStatus,
      completionRound: task.completionRound,
      requiredApproverIds: required,
      approvals: approvals.map((a) => ({
        userId: a.userId,
        approved: a.approved,
        comment: a.comment,
        createdAt: a.createdAt,
        user: a.user,
      })),
      approvedCount: approvals.filter((a) => a.approved).length,
      waitingForValuation:
        task.completionStatus === 'SUBMITTED' && task.valuationStatus !== 'VALUED',
      canReview: check.ok,
      reason: check.reason ?? null,
      pointsValue: task.pointsValue != null ? Number(task.pointsValue) : null,
      effectivePoints: task.effectivePoints != null ? Number(task.effectivePoints) : null,
      submittedAt: task.submittedAt,
      acceptedAt: task.acceptedAt,
    }
  },
}
