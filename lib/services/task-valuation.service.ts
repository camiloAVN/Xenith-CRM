import { prisma } from '@/lib/db/prisma'
import {
  contributionSettingsService,
  type ContributionSettings,
} from '@/lib/services/contribution-settings.service'
import {
  effectiveQuorum,
  getEligibleVoterIds,
  canVoteOnTask,
} from '@/lib/services/task-lifecycle'
import { TaskPermissionError } from '@/lib/services/task.service'
import { notificationService } from '@/lib/services/notification.service'
import {
  allowedScale,
  describeScale,
  isOnScale,
  snapToScale,
  stepsBetween,
} from '@/lib/services/point-scale'

/**
 * Valoración por puntos: la ventana de votación y su cierre.
 *
 * La ventana se abre UNA vez, al crear la tarea, y cierra por lo que ocurra
 * primero:
 *   - votaron todos los elegibles  -> cierra de inmediato con la mediana;
 *   - se venció el plazo           -> mediana de los votos que haya, y si no
 *                                     hubo ninguno, el mínimo de la escala.
 *
 * No se extiende ni se reabre.
 *
 * El valor que queda SIEMPRE pertenece a la escala Fibonacci: la mediana cruda
 * puede caer entre dos peldaños (3 y 8 dan 5.5) y se pega al más cercano.
 */

/** Mediana cruda. Con número par de votos puede caer entre dos peldaños. */
export function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface ValuationOutcome {
  pointsValue: number
  needsDiscussion: boolean
  reachedQuorum: boolean
  voteCount: number
  /** El valor quedó en el tope de la escala: es una épica y hay que partirla. */
  isEpic: boolean
}

/**
 * Valor final de una tarea a partir de sus votos.
 *
 * Sin ningún voto no hay nada que promediar y la tarea toma el mínimo de la
 * escala. Con votos pero sin quórum SÍ se usa su mediana: castigar al asignado
 * porque un compañero no votó es cobrarle algo que no está en sus manos; el
 * resultado queda marcado como "sin quórum" para que se vea de dónde salió.
 */
export function computeValuation(
  votes: number[],
  settings: ContributionSettings,
  eligibleVoterCount: number
): ValuationOutcome {
  const quorum = effectiveQuorum(settings.minVotes, eligibleVoterCount)
  const scale = allowedScale(settings.minPoints, settings.maxPoints)

  if (votes.length === 0) {
    return {
      pointsValue: scale[0],
      needsDiscussion: false,
      reachedQuorum: false,
      voteCount: 0,
      isEpic: false,
    }
  }

  const pointsValue = snapToScale(calculateMedian(votes), scale)
  // El desacuerdo se mide en peldaños de la escala, no en puntos: entre 13 y 21
  // hay 8 puntos de diferencia y solo un paso.
  const spread = stepsBetween(Math.min(...votes), Math.max(...votes), scale)

  return {
    pointsValue,
    // Aviso informativo: la mediana igual aplica, solo marca la tarjeta.
    needsDiscussion: spread >= settings.disagreementDelta,
    reachedQuorum: votes.length >= quorum,
    voteCount: votes.length,
    isEpic: pointsValue >= scale[scale.length - 1] && scale.length > 1,
  }
}

export const taskValuationService = {
  /**
   * Registra (o corrige) el voto de un miembro. Un voto por persona: si vuelve
   * a votar mientras la ventana sigue abierta, se sobrescribe el anterior.
   */
  async castVote(taskId: string, userId: string, value: number) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        valuationStatus: true,
        completionStatus: true,
        pointsValue: true,
        votingClosesAt: true,
      },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const settings = await contributionSettingsService.resolve(task.projectId)

    // El voto tiene que caer en un peldaño de la escala, no en cualquier número
    // del rango: un 7 no significa nada en Fibonacci.
    const scale = allowedScale(settings.minPoints, settings.maxPoints)
    if (!Number.isInteger(value) || !isOnScale(value, scale)) {
      throw new TaskPermissionError(`El voto debe ser ${describeScale(scale)}`)
    }

    const eligible = await getEligibleVoterIds(task.projectId, task.assignedTo)
    const check = canVoteOnTask(task, userId, eligible, task.votingClosesAt)
    if (!check.ok) throw new TaskPermissionError(check.reason as string)

    const vote = await prisma.taskPointVote.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId, value },
      update: { value },
    })

    // Si ya votaron TODOS los que podian votar, no tiene sentido esperar a que
    // venzan las 24h: el resultado no puede cambiar. La ventana se cierra ya y
    // la tarea queda con su valor. El plazo solo existe para el caso en que
    // alguien no vote.
    const voteCount = await prisma.taskPointVote.count({ where: { taskId } })
    if (eligible.length > 0 && voteCount >= eligible.length) {
      await this.settleTask(taskId, { force: true })
    }

    return vote
  },

  /**
   * Cierra la votación y fija el valor. Idempotente: el guard
   * `valuationStatus: { not: 'VALUED' }` en el UPDATE hace que, si dos lecturas
   * concurrentes intentan cerrar la misma tarea, solo una escriba.
   */
  async settleTask(
    taskId: string,
    options: { force?: boolean } = {}
  ): Promise<ValuationOutcome | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        valuationStatus: true,
        votingClosesAt: true,
      },
    })
    if (!task || task.valuationStatus === 'VALUED') return null

    // Solo se liquida una ventana YA VENCIDA. Sin esta guarda, las llamadas
    // preventivas desde la ruta de votos cerrarían cada votación abierta en su
    // primera lectura. `votingClosesAt` nulo = sin ventana, se liquida.
    //
    // `force` es la excepción: se usa cuando ya votaron todos los elegibles y
    // esperar al vencimiento no cambiaría el resultado.
    if (!options.force && task.votingClosesAt && task.votingClosesAt > new Date()) {
      return null
    }

    const settings = await contributionSettingsService.resolve(task.projectId)
    const [votes, eligible] = await Promise.all([
      prisma.taskPointVote.findMany({ where: { taskId }, select: { value: true } }),
      getEligibleVoterIds(task.projectId, task.assignedTo),
    ])

    const outcome = computeValuation(
      votes.map((v) => v.value),
      settings,
      eligible.length
    )

    const written = await prisma.task.updateMany({
      where: { id: taskId, valuationStatus: { not: 'VALUED' } },
      data: {
        valuationStatus: 'VALUED',
        pointsValue: outcome.pointsValue,
        needsDiscussion: outcome.needsDiscussion,
      },
    })
    if (written.count === 0) return null

    void notificationService.valuationSettled(taskId, {
      pointsValue: outcome.pointsValue,
      voteCount: outcome.voteCount,
      reachedQuorum: outcome.reachedQuorum,
    })

    // La tarea pudo terminarse y aprobarse ANTES de que cerrara la votacion.
    // En ese caso quedo esperando este momento para acreditar los puntos.
    // Import dinamico: task-completion.service importa TaskPermissionError de
    // task.service, que a su vez carga este modulo.
    try {
      const { taskCompletionService } = await import(
        '@/lib/services/task-completion.service'
      )
      await taskCompletionService.tryFinalizeAcceptance(taskId)
    } catch (error) {
      console.error('Error al finalizar aceptacion tras cerrar la votacion:', error)
    }

    return outcome
  },

  /**
   * Cierra todas las ventanas vencidas. Sin `projectId` barre todo el sistema
   * (es lo que llama el cron); con él, solo ese proyecto (cierre perezoso al
   * abrir el tablero).
   */
  async settleExpired(projectId?: string): Promise<string[]> {
    const expired = await prisma.task.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        valuationStatus: { not: 'VALUED' },
        votingClosesAt: { lte: new Date() },
      },
      select: { id: true },
    })

    const settled: string[] = []
    for (const task of expired) {
      const outcome = await this.settleTask(task.id)
      if (outcome) settled.push(task.id)
    }
    return settled
  },

  /** Estado de la votación de una tarea, tal como lo consume el panel. */
  async getVotingState(taskId: string, currentUserId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        valuationStatus: true,
        completionStatus: true,
        pointsValue: true,
        needsDiscussion: true,
        votingClosesAt: true,
      },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const [settings, eligible, votes] = await Promise.all([
      contributionSettingsService.resolve(task.projectId),
      getEligibleVoterIds(task.projectId, task.assignedTo),
      prisma.taskPointVote.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const isClosed = task.valuationStatus === 'VALUED'
    const check = canVoteOnTask(task, currentUserId, eligible, task.votingClosesAt)
    const myVote = votes.find((v) => v.userId === currentUserId)

    return {
      valuationStatus: task.valuationStatus,
      pointsValue: task.pointsValue != null ? Number(task.pointsValue) : null,
      needsDiscussion: task.needsDiscussion,
      votingClosesAt: task.votingClosesAt,
      minPoints: settings.minPoints,
      maxPoints: settings.maxPoints,
      scale: allowedScale(settings.minPoints, settings.maxPoints),
      isEpic:
        task.pointsValue != null &&
        Number(task.pointsValue) >= allowedScale(settings.minPoints, settings.maxPoints).slice(-1)[0],
      quorum: effectiveQuorum(settings.minVotes, eligible.length),
      eligibleVoterCount: eligible.length,
      voteCount: votes.length,
      myVote: myVote?.value ?? null,
      canVote: check.ok,
      reason: check.reason ?? null,
      // Los votos individuales solo se destapan al cerrar. Mostrarlos en vivo
      // ancla a quien todavía no ha votado; una vez fijado el valor, la
      // transparencia total no puede sesgar nada.
      votes: isClosed
        ? votes.map((v) => ({ userId: v.userId, value: v.value, user: v.user }))
        : [],
    }
  },
}
