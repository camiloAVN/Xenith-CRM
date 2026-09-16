import { prisma } from '@/lib/db/prisma'
import { getProjectMemberIds } from '@/lib/auth/permissions'
import { getRequiredApproverIds } from '@/lib/services/task-lifecycle'

/**
 * Lo que el bot de Telegram necesita saber de cada persona: sus pendientes y,
 * si se pasa `since`, qué le pasó desde la última consulta.
 *
 * Es SOLO LECTURA a propósito: el bot corre en otra infraestructura (n8n en
 * Railway) y nunca recibe credenciales de esta base. No liquida votaciones ni
 * manda correos; eso sigue siendo del cierre perezoso / cron.
 *
 * El aislamiento entre personas lo garantiza quien consume: la base del bot
 * cruza `email` con el participante y cada lista solo viaja al chat privado
 * de su dueño.
 */

export interface BotTask {
  id: string
  title: string
  projectId: string
  project: string
  dueDate: string | null
}

export interface BotUserPending {
  email: string
  name: string | null
  asignadas: (BotTask & { status: string; priority: string; overdueDays: number })[]
  enRevision: BotTask[]
  porVotar: (BotTask & { votingClosesAt: string | null })[]
  porAprobar: (BotTask & { assignee: string | null })[]
  novedades: {
    tipo: 'asignada' | 'votar' | 'aprobar' | 'rechazada' | 'aceptada'
    task: BotTask
    points?: number | null
  }[]
}

const DAY_MS = 86_400_000

function toBotTask(t: {
  id: string
  title: string
  projectId: string
  dueDate: Date | null
  project: { title: string }
}): BotTask {
  return {
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    project: t.project.title,
    dueDate: t.dueDate?.toISOString() ?? null,
  }
}

export const botService = {
  async getPending(options: { email?: string; since?: Date } = {}): Promise<BotUserPending[]> {
    const { email, since } = options
    const now = new Date()

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(email && { email: { equals: email, mode: 'insensitive' } }),
      },
      select: { id: true, email: true, name: true },
    })
    if (users.length === 0) return []

    const openTasks = await prisma.task.findMany({
      where: { completionStatus: { not: 'ACCEPTED' } },
      include: {
        project: { select: { title: true } },
        assignedUser: { select: { name: true } },
        pointVotes: { select: { userId: true } },
        approvals: { select: { userId: true, round: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    // Miembros y aprobadores se resuelven una vez por proyecto / asignado
    const memberCache = new Map<string, Promise<string[]>>()
    const approverCache = new Map<string, Promise<string[]>>()
    const membersOf = (projectId: string) => {
      if (!memberCache.has(projectId)) memberCache.set(projectId, getProjectMemberIds(projectId))
      return memberCache.get(projectId)!
    }
    const approversOf = (projectId: string, assigneeId: string | null) => {
      const key = `${projectId}:${assigneeId ?? ''}`
      if (!approverCache.has(key)) approverCache.set(key, getRequiredApproverIds(projectId, assigneeId))
      return approverCache.get(key)!
    }

    const [accepted, reassigned] = since
      ? await Promise.all([
          prisma.task.findMany({
            where: { acceptedAt: { gt: since }, completionStatus: 'ACCEPTED' },
            include: { project: { select: { title: true } } },
          }),
          prisma.taskHistory.findMany({
            where: { field: 'assigned_to', createdAt: { gt: since } },
            select: { taskId: true, userId: true },
          }),
        ])
      : [[], []]

    const result: BotUserPending[] = []
    for (const user of users) {
      const entry: BotUserPending = {
        email: user.email,
        name: user.name,
        asignadas: [],
        enRevision: [],
        porVotar: [],
        porAprobar: [],
        novedades: [],
      }

      for (const t of openTasks) {
        const base = toBotTask(t)

        if (t.assignedTo === user.id) {
          if (t.completionStatus === 'SUBMITTED') {
            entry.enRevision.push(base)
          } else {
            const overdueDays =
              t.dueDate && t.dueDate < now ? Math.floor((now.getTime() - t.dueDate.getTime()) / DAY_MS) : 0
            entry.asignadas.push({ ...base, status: t.status, priority: t.priority, overdueDays })
          }

          if (since) {
            // Quien se crea o se reasigna una tarea a sí mismo no necesita aviso
            const isNew = t.createdAt > since && t.reporterId !== user.id
            const wasReassigned = reassigned.some((h) => h.taskId === t.id && h.userId !== user.id)
            if (isNew || wasReassigned) entry.novedades.push({ tipo: 'asignada', task: base })
            if (t.completionStatus === 'PENDING' && t.lastRejectedAt && t.lastRejectedAt > since) {
              entry.novedades.push({ tipo: 'rechazada', task: base })
            }
          }
          continue
        }

        const votingOpen =
          t.valuationStatus === 'VOTING' && (!t.votingClosesAt || t.votingClosesAt > now)
        if (votingOpen && !t.pointVotes.some((v) => v.userId === user.id)) {
          if ((await membersOf(t.projectId)).includes(user.id)) {
            entry.porVotar.push({ ...base, votingClosesAt: t.votingClosesAt?.toISOString() ?? null })
            if (since && t.createdAt > since) entry.novedades.push({ tipo: 'votar', task: base })
          }
        }

        if (
          t.completionStatus === 'SUBMITTED' &&
          !t.approvals.some((a) => a.userId === user.id && a.round === t.completionRound) &&
          (await approversOf(t.projectId, t.assignedTo)).includes(user.id)
        ) {
          entry.porAprobar.push({ ...base, assignee: t.assignedUser?.name ?? null })
          if (since && t.submittedAt && t.submittedAt > since) {
            entry.novedades.push({ tipo: 'aprobar', task: base })
          }
        }
      }

      for (const t of accepted) {
        if (t.assignedTo !== user.id) continue
        entry.novedades.push({
          tipo: 'aceptada',
          task: toBotTask(t),
          points: t.effectivePoints != null ? Number(t.effectivePoints) : null,
        })
      }

      result.push(entry)
    }
    return result
  },
}
