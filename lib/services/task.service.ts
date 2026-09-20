import { prisma } from '@/lib/db/prisma'
import { taskRepository } from '@/lib/repositories/task.repository'
import {
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskFiltersDTO,
  ASSIGNEE_EDITABLE_FIELDS,
} from '@/lib/dto/task.dto'
import { TaskStatus } from '@prisma/client'
import { getProjectPermissions, getProjectMemberIds } from '@/lib/auth/permissions'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { canSubmitCompletion, canAssigneeChangeStatus } from '@/lib/services/task-lifecycle'
import { notificationService } from '@/lib/services/notification.service'
import {
  buildPenaltyPreview,
  type PenaltyTaskFields,
  type TaskPenaltyPreview,
} from '@/lib/services/task-penalty'

/**
 * Guarda de sprint (capacidad y épicas).
 *
 * Import dinámico: `sprint.service` importa `TaskPermissionError` de este
 * módulo, así que cargarlo arriba cerraría el ciclo.
 */
async function assertSprintFits(params: {
  sprintId: string | null
  assignedTo: string | null
  taskId?: string
  pointsValue?: number | null
}) {
  const { sprintService } = await import('@/lib/services/sprint.service')
  await sprintService.assertCanCommit(params)
}

/** Error de regla de negocio: las rutas lo traducen a 403/422. */
export class TaskPermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskPermissionError'
  }
}

/**
 * Cierra las ventanas de votación vencidas del proyecto antes de devolver
 * tareas. Sin cron configurado esto es lo único que las liquida, y aun con
 * cron evita mostrar como "abierta" una votación ya expirada.
 *
 * El import es dinámico porque task-valuation.service importa
 * `TaskPermissionError` de este módulo: cargarlo arriba crearía un ciclo.
 */
/**
 * Adjunta la penalizacion vigente a cada tarea.
 *
 * Se calcula en el servidor y no en el cliente para que las tres vistas
 * (Kanban, lista, Gantt) y el panel muestren exactamente el mismo numero, y
 * para que ese numero coincida con el que se acredita al aceptar.
 *
 * Los `settings` se resuelven UNA vez por peticion: la penalizacion en si es
 * calculo puro sobre campos que la tarea ya trae.
 */
async function withPenalty<T extends PenaltyTaskFields>(
  projectId: string,
  tasks: T[]
): Promise<Array<T & { penalty: TaskPenaltyPreview }>> {
  if (tasks.length === 0) return []
  const settings = await contributionSettingsService.resolve(projectId)
  const now = new Date()
  return tasks.map((task) => ({ ...task, penalty: buildPenaltyPreview(task, settings, now) }))
}

async function settleExpiredVotings(projectId: string) {
  try {
    const { taskValuationService } = await import('@/lib/services/task-valuation.service')
    await taskValuationService.settleExpired(projectId)
    // Y de paso se cobran las tareas que se pasaron de la fecha: sin cron, es
    // aqui donde el vencimiento se vuelve real.
    const { taskOverdueService } = await import('@/lib/services/task-overdue.service')
    await taskOverdueService.chargeOverdue(projectId)
  } catch (error) {
    // Nunca debe tumbar la carga del tablero.
    console.error('Error al cerrar votaciones vencidas o cobrar vencimientos:', error)
  }
}

const TRACKED_FIELDS = ['status', 'assignedTo', 'dueDate', 'priority', 'sprintId'] as const
type TrackedField = (typeof TRACKED_FIELDS)[number]

const FIELD_LABELS: Record<TrackedField, string> = {
  status: 'status',
  assignedTo: 'assigned_to',
  dueDate: 'due_date',
  priority: 'priority',
  sprintId: 'sprint',
}

export const taskService = {
  /**
   * Crea una tarea. La crea CUALQUIER miembro del proyecto: el trabajo lo
   * levanta quien lo ve, no solo el jefe.
   *
   * Quien la crea le pone su primera fecha de entrega; cambiarla después ya es
   * cosa de los jefes, para que nadie se corra su propio plazo. Y la votación
   * no se toca: el valor lo sigue poniendo el equipo, sin el asignado.
   *
   * Puede nacer SIN asignado (backlog estimado): el equipo la valora primero y
   * se reparte en la planeación del sprint.
   */
  async createTask(projectId: string, data: CreateTaskDTO, currentUserId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })
    if (!project) throw new Error('Proyecto no encontrado')

    const perms = await getProjectPermissions(projectId, currentUserId)
    if (!perms.canCreateTasks) {
      throw new TaskPermissionError('Solo los miembros del proyecto pueden crear tareas')
    }

    // El asignado tiene que pertenecer al equipo: si no, nunca podría cobrar
    // sus puntos ni aparecer en el reparto del proyecto.
    if (data.assignedTo) {
      const memberIds = await getProjectMemberIds(projectId)
      if (!memberIds.includes(data.assignedTo)) {
        throw new TaskPermissionError('El asignado debe ser miembro del proyecto')
      }
    }

    // Recién creada todavía no tiene valor, así que la guarda usa el mínimo:
    // lo que impide es meter a alguien que ya llenó su capacidad.
    await assertSprintFits({
      sprintId: data.sprintId ?? null,
      assignedTo: data.assignedTo ?? null,
    })

    const settings = await contributionSettingsService.resolve(projectId)
    const now = new Date()
    const votingClosesAt = new Date(now.getTime() + settings.votingWindowHours * 3600 * 1000)

    const taskData: CreateTaskDTO = {
      ...data,
      reporterId: data.reporterId ?? currentUserId,
    }

    const task = await taskRepository.create(projectId, taskData, { votingClosesAt })

    // Fire and forget: un fallo de correo no puede impedir crear la tarea.
    void notificationService.taskCreated(task.id)

    return task
  },

  /** El asignado marca la tarea como terminada y pasa a revisión de los jefes. */
  async submitCompletion(taskId: string, currentUserId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignedTo: true,
        valuationStatus: true,
        completionStatus: true,
        pointsValue: true,
        status: true,
        dueDate: true,
        lateAccruedDays: true,
        lateClockStartedAt: true,
      },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const check = canSubmitCompletion(task, currentUserId)
    if (!check.ok) throw new TaskPermissionError(check.reason as string)

    const now = new Date()
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        completionStatus: 'SUBMITTED',
        submittedAt: now,
        // La tarjeta se mueve sola a "En Revisión": marcar terminada y dejarla
        // en la columna anterior obligaba a arrastrarla a mano, y el tablero
        // dejaba de reflejar que la tarea espera a los jefes.
        status: 'REVIEW',
        completed: false,
      },
    })

    await prisma.taskHistory.createMany({
      data: [
        {
          taskId,
          userId: currentUserId,
          field: 'completion_status',
          oldValue: task.completionStatus,
          newValue: 'SUBMITTED',
        },
        ...(task.status !== 'REVIEW'
          ? [{
              taskId,
              userId: currentUserId,
              field: 'status',
              oldValue: task.status,
              newValue: 'REVIEW',
            }]
          : []),
      ],
    }).catch(console.error)

    void notificationService.completionSubmitted(taskId)

    return updated
  },

  async updateTask(taskId: string, data: UpdateTaskDTO, currentUserId: string) {
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        status: true,
        assignedTo: true,
        dueDate: true,
        priority: true,
        sprintId: true,
        pointsValue: true,
      },
    })
    if (!existing) throw new Error('Tarea no encontrada')

    // Un jefe edita cualquier campo. El asignado solo puede EJECUTAR su tarea:
    // mover la tarjeta y anotar horas. Editar la tarea —título, descripción,
    // prioridad, asignado, sprint y sobre todo la FECHA— es de los jefes: si el
    // asignado pudiera correr su propio plazo, el vencimiento no costaría nada.
    // Para contar avances están los comentarios, que sí son de todos.
    const perms = await getProjectPermissions(existing.projectId, currentUserId)
    if (!perms.canManageTasks) {
      if (existing.assignedTo !== currentUserId) {
        throw new TaskPermissionError('No tienes permiso para editar esta tarea')
      }
      const touched = Object.keys(data).filter(
        (k) => (data as Record<string, unknown>)[k] !== undefined
      )
      const forbidden = touched.filter(
        (k) => !ASSIGNEE_EDITABLE_FIELDS.includes(k as never)
      )
      if (forbidden.length > 0) {
        throw new TaskPermissionError(
          `Solo un jefe del proyecto puede cambiar: ${forbidden.join(', ')}`
        )
      }

      if (
        data.status !== undefined &&
        data.status !== existing.status &&
        !canAssigneeChangeStatus(existing.status, data.status)
      ) {
        throw new TaskPermissionError(
          'Solo puedes mover tu tarea de "Por Hacer" a "En Progreso". Cuando la termines, márcala como terminada y pasa sola a revisión.'
        )
      }
    }

    // Cambiar el compromiso —quién la hace, en qué sprint— pasa por la guarda
    // de capacidad y por el bloqueo de épicas. Reasignar dentro del backlog no
    // toca nada: el tope solo cuenta lo que está dentro de una caja de tiempo.
    if (data.assignedTo !== undefined || data.sprintId !== undefined) {
      const nextAssignee =
        data.assignedTo !== undefined ? data.assignedTo ?? null : existing.assignedTo
      const nextSprint =
        data.sprintId !== undefined ? data.sprintId ?? null : existing.sprintId

      if (nextAssignee && nextAssignee !== existing.assignedTo) {
        const memberIds = await getProjectMemberIds(existing.projectId)
        if (!memberIds.includes(nextAssignee)) {
          throw new TaskPermissionError('El asignado debe ser miembro del proyecto')
        }
      }

      await assertSprintFits({
        sprintId: nextSprint,
        assignedTo: nextAssignee,
        taskId,
        pointsValue: existing.pointsValue != null ? Number(existing.pointsValue) : null,
      })
    }

    // Build history entries for changed tracked fields
    const historyEntries: Array<{
      taskId: string
      userId: string
      field: string
      oldValue: string | null
      newValue: string | null
    }> = []

    for (const field of TRACKED_FIELDS) {
      const oldRaw = existing[field]
      const newRaw = data[field]

      if (newRaw === undefined) continue

      const toStr = (v: unknown) => {
        if (v instanceof Date) return v.toISOString()
        if (v == null) return ''
        return String(v)
      }
      const oldValue = toStr(oldRaw)
      const newValue = toStr(newRaw)

      if (oldValue !== newValue) {
        historyEntries.push({
          taskId,
          userId: currentUserId,
          field: FIELD_LABELS[field],
          oldValue: oldRaw != null ? oldValue : null,
          newValue: newRaw != null && newRaw !== '' ? newValue : null,
        })
      }
    }

    // Update task
    const updated = await taskRepository.update(taskId, data)

    // Write history in background (non-blocking)
    if (historyEntries.length > 0) {
      prisma.taskHistory.createMany({ data: historyEntries }).catch(console.error)
    }

    return updated
  },

  async deleteTask(taskId: string, currentUserId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, completionStatus: true },
    })
    if (!task) throw new Error('Tarea no encontrada')

    const perms = await getProjectPermissions(task.projectId, currentUserId)
    if (!perms.canManageTasks) {
      throw new TaskPermissionError('Solo los jefes del proyecto pueden eliminar tareas')
    }

    // Una tarea aceptada ya acreditó puntos en el ledger; borrarla dejaría el
    // reparto cuadrando contra un registro huérfano.
    if (task.completionStatus === 'ACCEPTED') {
      throw new TaskPermissionError(
        'No se puede eliminar una tarea ya aceptada: sus puntos están en el ledger'
      )
    }

    return taskRepository.delete(taskId)
  },

  /**
   * Reordenar el Kanban es la capa de flujo: cualquier miembro puede mover
   * tarjetas y eso NO acredita ni descuenta puntos.
   */
  async reorderTasks(
    projectId: string,
    tasks: { id: string; order: number; status: TaskStatus }[],
    currentUserId: string
  ) {
    const perms = await getProjectPermissions(projectId, currentUserId)
    if (!perms.isMember && !perms.isOwner) {
      throw new TaskPermissionError('Solo los miembros del proyecto pueden mover tareas')
    }

    // Sin esta validación la regla de estados sería decorativa: bastaría con
    // arrastrar la tarjeta en el Kanban para saltársela. Reordenar dentro de
    // una misma columna sigue libre para todo el equipo.
    if (!perms.canManageTasks) {
      const current = await prisma.task.findMany({
        where: { id: { in: tasks.map((t) => t.id) } },
        select: { id: true, status: true, assignedTo: true },
      })
      const byId = new Map(current.map((t) => [t.id, t]))

      for (const t of tasks) {
        const existing = byId.get(t.id)
        if (!existing || existing.status === t.status) continue

        if (
          existing.assignedTo !== currentUserId ||
          !canAssigneeChangeStatus(existing.status, t.status)
        ) {
          throw new TaskPermissionError(
            'Solo puedes mover tus propias tareas de "Por Hacer" a "En Progreso". El resto de columnas las mueve el flujo de aprobación.'
          )
        }
      }
    }

    return taskRepository.reorder(tasks)
  },

  async getTasksByProject(projectId: string, filters: TaskFiltersDTO) {
    await settleExpiredVotings(projectId)
    const tasks = await taskRepository.findMany(projectId, filters)
    return withPenalty(projectId, tasks)
  },

  async getKanbanBoard(projectId: string, sprintId?: string) {
    await settleExpiredVotings(projectId)
    const board = await taskRepository.getKanbanBoard(projectId, sprintId)

    const settings = await contributionSettingsService.resolve(projectId)
    const now = new Date()
    return Object.fromEntries(
      Object.entries(board).map(([status, tasks]) => [
        status,
        tasks.map((task) => ({ ...task, penalty: buildPenaltyPreview(task, settings, now) })),
      ])
    ) as Record<TaskStatus, Array<(typeof board)[TaskStatus][number] & { penalty: TaskPenaltyPreview }>>
  },

  async getTaskById(taskId: string) {
    const task = await taskRepository.findById(taskId)
    if (!task) return null
    const [decorated] = await withPenalty(task.projectId, [task])
    return decorated
  },
}
