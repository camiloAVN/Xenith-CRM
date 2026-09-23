import { prisma } from '@/lib/db/prisma'
import { getProjectPermissions } from '@/lib/auth/permissions'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { shouldChargeOverdue } from '@/lib/services/task-penalty'
import { notificationService } from '@/lib/services/notification.service'
import { parseDueDate } from '@/lib/utils/due-date'

/**
 * Vencimiento automático y revaluación.
 *
 * Dos caras de la misma regla:
 *
 *   - **Cobro:** al pasarse de la fecha límite sin entregar, la tarea cuesta su
 *     valor completo. Se escribe UN asiento `TASK_OVERDUE` negativo y la tarea
 *     queda marcada (`overdueChargedAt`) para no cobrarlo dos veces.
 *   - **Revaluación:** si el asignado ve que la tarea es más dura de lo que se
 *     estimó, la pide ANTES de que el reloj le cueste. Mientras esté pedida la
 *     tarea está en pausa: no se cobra aunque la fecha pase. Los jefes deciden
 *     nueva fecha y, si hace falta, nueva votación de puntos.
 *
 * El ledger sigue siendo append-only: el cobro no se borra ni se edita. Si la
 * tarea después se entrega y se acepta, se acredita su valor VIGENTE, así que
 * una revaluación que suba el valor deja saldo a favor.
 */

export const taskOverdueService = {
  /**
   * Cobra las tareas vencidas. Sin `projectId` barre todo (lo llama el cron);
   * con él, solo ese proyecto (barrido perezoso al abrir el tablero).
   *
   * Idempotente: el `updateMany` con guarda `overdueChargedAt: null` hace que
   * dos barridos simultáneos no puedan cobrar dos veces la misma tarea.
   */
  async chargeOverdue(projectId?: string): Promise<string[]> {
    const now = new Date()
    const candidates = await prisma.task.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        dueDate: { lt: now },
        completionStatus: 'PENDING',
        valuationStatus: 'VALUED',
        overdueChargedAt: null,
        revaluationRequestedAt: null,
        assignedTo: { not: null },
        pointsValue: { not: null },
      },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        dueDate: true,
        pointsValue: true,
        completionStatus: true,
        effectivePoints: true,
        overdueChargedAt: true,
        revaluationRequestedAt: true,
        valuationStatus: true,
      },
    })

    const charged: string[] = []
    for (const task of candidates) {
      if (!shouldChargeOverdue(task, now)) continue
      const points = Number(task.pointsValue)

      await prisma.$transaction(async (tx) => {
        const written = await tx.task.updateMany({
          where: { id: task.id, overdueChargedAt: null },
          data: { overdueChargedAt: now },
        })
        // Otro barrido llegó primero: no duplicar el asiento.
        if (written.count === 0) return

        await tx.pointLedgerEntry.create({
          data: {
            projectId: task.projectId,
            userId: task.assignedTo as string,
            taskId: task.id,
            type: 'TASK_OVERDUE',
            points: -points,
            note: `Se pasó de la fecha límite: −${points} puntos`,
          },
        })
        charged.push(task.id)
      })

      if (charged.includes(task.id)) {
        void notificationService.taskOverdue(task.id, points)
      }
    }

    return charged
  },

  /**
   * El asignado pide revaluación: la tarea resultó más dura de lo estimado.
   *
   * Pausa el reloj de inmediato —esa es la gracia: se pide ANTES de que la
   * fecha cueste— y avisa a los jefes por correo.
   */
  async requestRevaluation(taskId: string, currentUserId: string, reason?: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        completionStatus: true,
        revaluationRequestedAt: true,
      },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const perms = await getProjectPermissions(task.projectId, currentUserId)
    if (task.assignedTo !== currentUserId && !perms.canManageTasks) {
      throw new TaskPermissionError(
        'Solo quien tiene la tarea asignada puede pedir revaluación'
      )
    }
    if (task.completionStatus === 'ACCEPTED') {
      throw new TaskPermissionError('Esa tarea ya fue aceptada')
    }
    if (task.revaluationRequestedAt) {
      throw new TaskPermissionError('Esa tarea ya está en revaluación')
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        revaluationRequestedAt: new Date(),
        revaluationReason: reason?.trim() || null,
      },
    })

    await prisma.taskHistory
      .create({
        data: {
          taskId,
          userId: currentUserId,
          field: 'revaluation',
          oldValue: null,
          newValue: reason?.trim() || 'solicitada',
        },
      })
      .catch(console.error)

    void notificationService.revaluationRequested(taskId, currentUserId, reason)

    return updated
  },

  /**
   * Un jefe resuelve la revaluación: nueva fecha y, si el equipo lo ve
   * distinto, nueva votación de puntos.
   *
   * Reabrir la votación borra los votos anteriores y abre una ventana nueva.
   * El valor viejo se queda hasta que cierre la nueva: mientras tanto la tarea
   * no está "sin valor", solo pendiente de confirmarlo.
   */
  async resolveRevaluation(
    taskId: string,
    currentUserId: string,
    options: { newDueDate?: string | null; reopenVoting?: boolean } = {}
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, assignedTo: true, revaluationRequestedAt: true },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const perms = await getProjectPermissions(task.projectId, currentUserId)
    if (!perms.canManageTasks) {
      throw new TaskPermissionError('Solo los jefes del proyecto resuelven una revaluación')
    }
    if (!task.revaluationRequestedAt) {
      throw new TaskPermissionError('Esa tarea no está en revaluación')
    }

    const settings = await contributionSettingsService.resolve(task.projectId)
    const now = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      if (options.reopenVoting) {
        // Votación nueva de verdad: los votos viejos se van para que nadie
        // arrastre el número que ya se demostró equivocado.
        await tx.taskPointVote.deleteMany({ where: { taskId } })
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          revaluationRequestedAt: null,
          revaluationReason: null,
          ...(options.newDueDate !== undefined
            ? { dueDate: options.newDueDate ? parseDueDate(options.newDueDate) : null }
            : {}),
          // Fecha nueva = borrón y cuenta nueva: el cobro del vencimiento
          // anterior ya está en el ledger y ahí se queda, pero la tarea puede
          // volver a vencer y volver a cobrarse con su valor nuevo.
          ...(options.newDueDate ? { overdueChargedAt: null } : {}),
          ...(options.reopenVoting
            ? {
                valuationStatus: 'VOTING' as const,
                votingClosesAt: new Date(now.getTime() + settings.votingWindowHours * 3_600_000),
                needsDiscussion: false,
              }
            : {}),
        },
      })
    })

    await prisma.taskHistory
      .create({
        data: {
          taskId,
          userId: currentUserId,
          field: 'revaluation',
          oldValue: 'solicitada',
          newValue: options.reopenVoting ? 'resuelta con nueva votación' : 'resuelta',
        },
      })
      .catch(console.error)

    void notificationService.revaluationResolved(taskId, currentUserId, {
      reopenedVoting: Boolean(options.reopenVoting),
    })

    return updated
  },
}
