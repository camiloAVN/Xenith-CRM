import { prisma } from '@/lib/db/prisma'
import { getProjectPermissions, getProjectMemberIds } from '@/lib/auth/permissions'
import { contributionSettingsService } from '@/lib/services/contribution-settings.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { EPIC_POINTS } from '@/lib/services/point-scale'

/**
 * Sprints: la caja de tiempo que vuelve Scrum al sistema de puntos.
 *
 * Sin sprint los puntos son un contador infinito y la única forma de ganar más
 * es acumular tareas. Con sprint hay dos frenos:
 *
 *   1. **Capacidad**: cada persona se compromete a un tope de puntos por
 *      sprint. No se puede asignar por encima de ese tope.
 *   2. **Arrastre**: lo que no se termina pasa al siguiente sprint con un
 *      descuento, así que estirar el trabajo tampoco paga.
 *
 * Un proyecto tiene como mucho UN sprint activo. El backlog (tareas con
 * `sprintId = null`) es donde viven las tareas ya estimadas que todavía no se
 * comprometió nadie.
 */

export interface SprintCapacityRow {
  userId: string
  name: string | null
  email: string
  /** Tope de puntos comprometidos. */
  capacity: number
  /** Puntos ya comprometidos (tareas del sprint asignadas a esa persona). */
  committed: number
  /** Puntos ya aceptados dentro del sprint. */
  accepted: number
}

/** Puntos que "pesa" una tarea al planear: su valor estimado, o el mínimo si aún no cierra la votación. */
function plannedPoints(task: { pointsValue: unknown | null }, fallback: number): number {
  return task.pointsValue != null ? Number(task.pointsValue) : fallback
}

async function requireLead(projectId: string, userId: string) {
  const perms = await getProjectPermissions(projectId, userId)
  if (!perms.canManageTasks) {
    throw new TaskPermissionError('Solo los jefes del proyecto pueden manejar los sprints')
  }
  return perms
}

export const sprintService = {
  /** Sprints del proyecto, del más reciente al más viejo. */
  async list(projectId: string) {
    return prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { tasks: true } } },
    })
  },

  /**
   * Cuántas tareas hay en cada sitio: en el backlog y en total.
   *
   * Sin esto el tablero filtrado por sprint parece haber perdido tareas: el
   * contador del proyecto dice 4 y en pantalla salen 3, sin pista de dónde
   * está la cuarta.
   */
  async getTaskCounts(projectId: string) {
    const [total, backlog] = await Promise.all([
      prisma.task.count({ where: { projectId } }),
      prisma.task.count({ where: { projectId, sprintId: null } }),
    ])
    return { total, backlog }
  },

  async getActive(projectId: string) {
    return prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    })
  },

  /**
   * Crea un sprint. Las fechas por defecto salen de la configuración
   * (`sprintLengthDays`), y el nombre se autonumera: "Sprint 3".
   */
  async create(
    projectId: string,
    data: { name?: string; goal?: string | null; startDate?: string; endDate?: string },
    currentUserId: string
  ) {
    await requireLead(projectId, currentUserId)
    const settings = await contributionSettingsService.resolve(projectId)

    const start = data.startDate ? new Date(data.startDate) : new Date()
    const end = data.endDate
      ? new Date(data.endDate)
      : new Date(start.getTime() + settings.sprintLengthDays * 86_400_000)

    if (end <= start) {
      throw new TaskPermissionError('El sprint debe terminar después de empezar')
    }

    const count = await prisma.sprint.count({ where: { projectId } })
    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name: data.name?.trim() || `Sprint ${count + 1}`,
        goal: data.goal?.trim() || null,
        startDate: start,
        endDate: end,
      },
    })

    // Todo el equipo arranca con la capacidad por defecto; el jefe la ajusta
    // después según la dedicación real de cada quien.
    const memberIds = await getProjectMemberIds(projectId)
    if (memberIds.length > 0) {
      await prisma.sprintCapacity.createMany({
        data: memberIds.map((userId) => ({
          sprintId: sprint.id,
          userId,
          points: settings.defaultCapacityPoints,
        })),
        skipDuplicates: true,
      })
    }

    return sprint
  },

  async update(
    sprintId: string,
    data: { name?: string; goal?: string | null; startDate?: string; endDate?: string },
    currentUserId: string
  ) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint no encontrado')
    await requireLead(sprint.projectId, currentUserId)

    if (sprint.status === 'CLOSED') {
      throw new TaskPermissionError('Un sprint cerrado ya no se edita')
    }

    const startDate = data.startDate ? new Date(data.startDate) : sprint.startDate
    const endDate = data.endDate ? new Date(data.endDate) : sprint.endDate
    if (endDate <= startDate) {
      throw new TaskPermissionError('El sprint debe terminar después de empezar')
    }

    return prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.goal !== undefined ? { goal: data.goal?.trim() || null } : {}),
        startDate,
        endDate,
      },
    })
  },

  /** Arranca el sprint. Solo puede haber uno activo por proyecto. */
  async start(sprintId: string, currentUserId: string) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint no encontrado')
    await requireLead(sprint.projectId, currentUserId)

    if (sprint.status !== 'PLANNED') {
      throw new TaskPermissionError('Ese sprint ya arrancó o ya está cerrado')
    }
    const active = await this.getActive(sprint.projectId)
    if (active) {
      throw new TaskPermissionError(
        `Cierra primero "${active.name}": un proyecto solo puede tener un sprint corriendo`
      )
    }

    return prisma.sprint.update({
      where: { id: sprintId },
      data: { status: 'ACTIVE' },
    })
  },

  /**
   * Cierra el sprint y arrastra lo que quedó sin aceptar.
   *
   * El arrastre es lo que hace que la caja de tiempo signifique algo: las
   * tareas no aceptadas pasan al sprint destino con `carriedOverCount + 1`, y
   * ese contador descuenta al acreditarlas. Sin destino, vuelven al backlog
   * (el arrastre se cuenta igual: el compromiso se incumplió).
   */
  async close(
    sprintId: string,
    options: { nextSprintId?: string | null } = {},
    currentUserId: string
  ) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint no encontrado')
    await requireLead(sprint.projectId, currentUserId)

    if (sprint.status === 'CLOSED') {
      throw new TaskPermissionError('Ese sprint ya está cerrado')
    }

    let nextSprintId: string | null = null
    if (options.nextSprintId) {
      const next = await prisma.sprint.findFirst({
        where: { id: options.nextSprintId, projectId: sprint.projectId },
      })
      if (!next) throw new TaskPermissionError('El sprint destino no es de este proyecto')
      if (next.status === 'CLOSED') {
        throw new TaskPermissionError('No se puede arrastrar a un sprint cerrado')
      }
      nextSprintId = next.id
    }

    const pending = await prisma.task.findMany({
      where: { sprintId, completionStatus: { not: 'ACCEPTED' } },
      select: { id: true },
    })

    const [accepted] = await prisma.$transaction([
      prisma.task.findMany({
        where: { sprintId, completionStatus: 'ACCEPTED' },
        select: { id: true, assignedTo: true, effectivePoints: true },
      }),
      prisma.task.updateMany({
        where: { id: { in: pending.map((t) => t.id) } },
        data: { sprintId: nextSprintId, carriedOverCount: { increment: 1 } },
      }),
      prisma.sprint.update({
        where: { id: sprintId },
        data: { status: 'CLOSED', closedAt: new Date() },
      }),
    ])

    const velocity = accepted.reduce(
      (sum, t) => sum + (t.effectivePoints != null ? Number(t.effectivePoints) : 0),
      0
    )

    return {
      sprintId,
      carriedOver: pending.length,
      nextSprintId,
      acceptedTasks: accepted.length,
      velocity: Math.round(velocity * 100) / 100,
    }
  },

  /** Ajusta el tope de puntos de una persona en un sprint. */
  async setCapacity(
    sprintId: string,
    userId: string,
    points: number,
    currentUserId: string
  ) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint no encontrado')
    await requireLead(sprint.projectId, currentUserId)

    if (!Number.isInteger(points) || points < 0 || points > 100) {
      throw new TaskPermissionError('La capacidad debe ser un entero entre 0 y 100 puntos')
    }
    const memberIds = await getProjectMemberIds(sprint.projectId)
    if (!memberIds.includes(userId)) {
      throw new TaskPermissionError('Esa persona no es del equipo del proyecto')
    }

    return prisma.sprintCapacity.upsert({
      where: { sprintId_userId: { sprintId, userId } },
      create: { sprintId, userId, points },
      update: { points },
    })
  },

  /**
   * Capacidad y compromiso de cada miembro en un sprint.
   *
   * `committed` cuenta el valor estimado de TODAS las tareas del sprint
   * asignadas a la persona (aceptadas incluidas): el compromiso es lo que se
   * metió a la caja de tiempo, no lo que queda pendiente.
   */
  async getCapacities(sprintId: string): Promise<SprintCapacityRow[]> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true },
    })
    if (!sprint) throw new Error('Sprint no encontrado')

    const settings = await contributionSettingsService.resolve(sprint.projectId)
    const [rows, tasks, memberIds] = await Promise.all([
      prisma.sprintCapacity.findMany({
        where: { sprintId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.task.findMany({
        where: { sprintId },
        select: {
          assignedTo: true,
          pointsValue: true,
          effectivePoints: true,
          completionStatus: true,
        },
      }),
      getProjectMemberIds(sprint.projectId),
    ])

    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, email: true },
    })
    const capacityByUser = new Map(rows.map((r) => [r.userId, r.points]))

    return users.map((user) => {
      const mine = tasks.filter((t) => t.assignedTo === user.id)
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        capacity: capacityByUser.get(user.id) ?? settings.defaultCapacityPoints,
        committed: Math.round(
          mine.reduce((sum, t) => sum + plannedPoints(t, settings.minPoints), 0) * 100
        ) / 100,
        accepted: Math.round(
          mine
            .filter((t) => t.completionStatus === 'ACCEPTED')
            .reduce((sum, t) => sum + (t.effectivePoints != null ? Number(t.effectivePoints) : 0), 0) * 100
        ) / 100,
      }
    })
  },

  /**
   * Guarda de capacidad: se llama antes de meter una tarea a un sprint o de
   * asignársela a alguien dentro de uno.
   *
   * Deja pasar cuando la tarea no está en un sprint (backlog) o no tiene
   * asignado: el tope solo aplica al compromiso real.
   */
  async assertCanCommit(params: {
    sprintId: string | null
    assignedTo: string | null
    taskId?: string
    pointsValue?: number | null
  }) {
    const { sprintId, assignedTo, taskId } = params
    if (!sprintId || !assignedTo) return

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true, name: true, status: true },
    })
    if (!sprint) throw new TaskPermissionError('Ese sprint no existe')
    if (sprint.status === 'CLOSED') {
      throw new TaskPermissionError('No se pueden meter tareas a un sprint cerrado')
    }

    const settings = await contributionSettingsService.resolve(sprint.projectId)

    // Una épica no entra a un sprint: hay que partirla. Es el bloqueo que en la
    // Fase 1 era solo un aviso.
    const points = params.pointsValue ?? null
    if (points != null && points >= EPIC_POINTS) {
      throw new TaskPermissionError(
        `La tarea quedó valorada en ${EPIC_POINTS} puntos: es una épica y hay que partirla antes de comprometerla en un sprint`
      )
    }

    const [capacityRow, tasks] = await Promise.all([
      prisma.sprintCapacity.findUnique({
        where: { sprintId_userId: { sprintId, userId: assignedTo } },
        select: { points: true },
      }),
      prisma.task.findMany({
        where: { sprintId, assignedTo, ...(taskId ? { id: { not: taskId } } : {}) },
        select: { pointsValue: true },
      }),
    ])

    const capacity = capacityRow?.points ?? settings.defaultCapacityPoints
    const committed = tasks.reduce((sum, t) => sum + plannedPoints(t, settings.minPoints), 0)
    const adding = points ?? settings.minPoints

    if (committed + adding > capacity) {
      throw new TaskPermissionError(
        `No cabe en ${sprint.name}: esa persona ya tiene ${committed} de ${capacity} puntos comprometidos y esta tarea suma ${adding}. ` +
          `Súbele la capacidad, saca otra tarea del sprint o déjala en el backlog.`
      )
    }
  },

  /**
   * Velocidad por sprint cerrado: puntos EFECTIVOS aceptados (los que
   * entraron al ledger), en total y por persona.
   *
   * Sale de las tareas del sprint y no del ledger porque es una medida de
   * planeación —cuánto cabe en la próxima caja de tiempo—, no de reparto.
   */
  async getVelocity(projectId: string) {
    const sprints = await prisma.sprint.findMany({
      where: { projectId, status: { in: ['ACTIVE', 'CLOSED'] } },
      orderBy: { startDate: 'asc' },
      include: {
        tasks: {
          where: { completionStatus: 'ACCEPTED' },
          select: { assignedTo: true, effectivePoints: true },
        },
      },
    })

    return sprints.map((sprint) => {
      const byUser = new Map<string, number>()
      let total = 0
      for (const task of sprint.tasks) {
        const points = task.effectivePoints != null ? Number(task.effectivePoints) : 0
        total += points
        if (task.assignedTo) {
          byUser.set(task.assignedTo, (byUser.get(task.assignedTo) ?? 0) + points)
        }
      }
      return {
        sprintId: sprint.id,
        name: sprint.name,
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        points: Math.round(total * 100) / 100,
        tasks: sprint.tasks.length,
        byUser: [...byUser.entries()].map(([userId, points]) => ({
          userId,
          points: Math.round(points * 100) / 100,
        })),
      }
    })
  },
}
