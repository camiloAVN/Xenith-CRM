import { Resend } from 'resend'
import { prisma } from '@/lib/db/prisma'
import { getProjectMemberIds } from '@/lib/auth/permissions'
import { getEligibleVoterIds, getRequiredApproverIds } from '@/lib/services/task-lifecycle'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import {
  votingOpenedEmail,
  valuationSettledEmail,
  completionSubmittedEmail,
  completionAcceptedEmail,
  completionRejectedEmail,
  type TaskEmailContext,
} from '@/lib/email/task-templates'

/**
 * Notificaciones del sistema de puntos, por correo (Resend).
 *
 * Regla de oro: notificar NUNCA puede tumbar la operación. Todos los métodos
 * atrapan sus propios errores y devuelven void — si Resend está caído o falta
 * la API key, la tarea igual se crea, se vota y se acepta. Por eso las llamadas
 * desde los servicios son "fire and forget".
 */

// Mismo remitente por defecto que /api/cotizacion: es el dominio verificado en
// Resend. El 'onboarding@resend.dev' de pruebas solo entrega al dueno de la
// cuenta, asi que los avisos al resto del equipo no llegarian.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Xenith <contacto@xenith.com.co>'

// Cliente perezoso: en desarrollo sin RESEND_API_KEY no debe reventar el import.
let client: Resend | null = null
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

interface Recipient {
  id: string
  email: string
  name: string | null
}

/** Correos de destinatarios activos, sin repetidos. */
async function resolveRecipients(userIds: string[]): Promise<Recipient[]> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return []

  return prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true, email: true, name: true },
  })
}

async function send(to: Recipient[], subject: string, html: string): Promise<void> {
  if (to.length === 0) return

  const resend = getClient()
  if (!resend) {
    console.info(`[notificaciones] RESEND_API_KEY sin configurar; se omite "${subject}"`)
    return
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: to.map((r) => r.email),
      subject,
      html,
    })
  } catch (error) {
    console.error(`[notificaciones] fallo al enviar "${subject}":`, error)
  }
}

/** Datos de la tarea que necesitan todas las plantillas. */
async function loadContext(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      projectId: true,
      assignedTo: true,
      dueDate: true,
      pointsValue: true,
      effectivePoints: true,
      needsDiscussion: true,
      lateAccruedDays: true,
      votingClosesAt: true,
      project: { select: { title: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })
  if (!task) return null

  const ctx: TaskEmailContext = {
    projectId: task.projectId,
    projectTitle: task.project.title,
    taskTitle: task.title,
    assigneeName: task.assignedUser?.name || task.assignedUser?.email || 'sin asignar',
    dueDate: task.dueDate,
  }
  return { task, ctx }
}

export const notificationService = {
  /** Tarea creada → a quienes pueden votarla (el equipo menos el asignado). */
  async taskCreated(taskId: string): Promise<void> {
    try {
      const loaded = await loadContext(taskId)
      if (!loaded) return
      const { task, ctx } = loaded
      const closesAt = task.votingClosesAt
      if (!closesAt) return

      const [voterIds, settings] = await Promise.all([
        getEligibleVoterIds(task.projectId, task.assignedTo),
        contributionSettingsService.resolve(task.projectId),
      ])
      const to = await resolveRecipients(voterIds)

      await send(
        to,
        `Por valorar: ${task.title}`,
        votingOpenedEmail({
          ...ctx,
          closesAt,
          minPoints: settings.minPoints,
          maxPoints: settings.maxPoints,
        })
      )
    } catch (error) {
      console.error('[notificaciones] taskCreated:', error)
    }
  },

  /** Votación cerrada → a todo el equipo del proyecto. */
  async valuationSettled(
    taskId: string,
    outcome: { pointsValue: number; voteCount: number; reachedQuorum: boolean }
  ): Promise<void> {
    try {
      const loaded = await loadContext(taskId)
      if (!loaded) return
      const { task, ctx } = loaded

      const to = await resolveRecipients(await getProjectMemberIds(task.projectId))

      await send(
        to,
        `Valorada en ${outcome.pointsValue} puntos: ${task.title}`,
        valuationSettledEmail({
          ...ctx,
          pointsValue: outcome.pointsValue,
          voteCount: outcome.voteCount,
          reachedQuorum: outcome.reachedQuorum,
          needsDiscussion: task.needsDiscussion,
        })
      )
    } catch (error) {
      console.error('[notificaciones] valuationSettled:', error)
    }
  },

  /** El asignado marcó terminada → a los jefes que deben aceptarla. */
  async completionSubmitted(taskId: string): Promise<void> {
    try {
      const loaded = await loadContext(taskId)
      if (!loaded) return
      const { task, ctx } = loaded

      const approverIds = await getRequiredApproverIds(task.projectId, task.assignedTo)
      const to = await resolveRecipients(approverIds)

      await send(to, `Por aprobar: ${task.title}`, completionSubmittedEmail(ctx))
    } catch (error) {
      console.error('[notificaciones] completionSubmitted:', error)
    }
  },

  /** Cumplimiento aceptado → al asignado, con los puntos acreditados. */
  async completionAccepted(taskId: string): Promise<void> {
    try {
      const loaded = await loadContext(taskId)
      if (!loaded) return
      const { task, ctx } = loaded
      const assigneeId = task.assignedTo
      if (!assigneeId) return

      const pointsValue = Number(task.pointsValue ?? 0)
      const effectivePoints = Number(task.effectivePoints ?? 0)
      const to = await resolveRecipients([assigneeId])

      await send(
        to,
        `Aceptada: ${task.title} (+${effectivePoints} puntos)`,
        completionAcceptedEmail({
          ...ctx,
          pointsValue,
          effectivePoints,
          penalty: Math.round((pointsValue - effectivePoints) * 100) / 100,
          daysLate: Math.max(0, Math.floor(Number(task.lateAccruedDays))),
        })
      )
    } catch (error) {
      console.error('[notificaciones] completionAccepted:', error)
    }
  },

  /**
   * Cumplimiento rechazado → al asignado.
   *
   * No estaba en la lista original, pero sin este correo la persona no se
   * entera de que su tarea volvió a en progreso y de que el reloj de retraso
   * está corriendo otra vez.
   */
  async completionRejected(
    taskId: string,
    reviewerId: string,
    comment?: string | null
  ): Promise<void> {
    try {
      const loaded = await loadContext(taskId)
      if (!loaded) return
      const { task, ctx } = loaded
      const assigneeId = task.assignedTo
      if (!assigneeId) return

      const [reviewer] = await resolveRecipients([reviewerId])
      const to = await resolveRecipients([assigneeId])

      await send(
        to,
        `Rechazada: ${task.title}`,
        completionRejectedEmail({
          ...ctx,
          reviewerName: reviewer?.name || reviewer?.email || 'Un jefe del proyecto',
          comment,
        })
      )
    } catch (error) {
      console.error('[notificaciones] completionRejected:', error)
    }
  },
}
