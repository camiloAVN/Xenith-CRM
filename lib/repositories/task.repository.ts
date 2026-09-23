import { prisma } from '@/lib/db/prisma'
import { TaskFiltersDTO, CreateTaskDTO, UpdateTaskDTO } from '@/lib/dto/task.dto'
import { TaskStatus } from '@prisma/client'
import { dueDayEnd, dueDayStart, parseDueDate } from '@/lib/utils/due-date'

/** Estado inicial de las capas de puntos, calculado por el servicio. */
export interface TaskLifecycleInit {
  votingClosesAt: Date
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
}

const taskInclude = {
  assignedUser: { select: userSelect },
  reporter: { select: userSelect },
}

const taskFullInclude = {
  assignedUser: { select: userSelect },
  reporter: { select: userSelect },
  comments: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
  history: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'desc' as const },
  },
  attachments: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'desc' as const },
  },
}

export const taskRepository = {
  async findMany(projectId: string, filters: TaskFiltersDTO) {
    const where: Record<string, unknown> = { projectId }

    if (filters.status) {
      const statuses = filters.status.split(',').filter(Boolean) as TaskStatus[]
      where.status = { in: statuses }
    }
    if (filters.priority) {
      where.priority = { in: filters.priority.split(',').filter(Boolean) }
    }
    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo
    }
    if (filters.sprintId) {
      where.sprintId = filters.sprintId === 'backlog' ? null : filters.sprintId
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' }
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {}
      if (filters.dueDateFrom) (where.dueDate as Record<string, unknown>).gte = dueDayStart(filters.dueDateFrom)
      if (filters.dueDateTo) (where.dueDate as Record<string, unknown>).lte = dueDayEnd(filters.dueDateTo)
    }

    return prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  },

  async findById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: taskFullInclude,
    })
  },

  async create(projectId: string, data: CreateTaskDTO, lifecycle: TaskLifecycleInit) {
    const maxOrderResult = await prisma.task.aggregate({
      where: { projectId, status: data.status ?? 'TODO' },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    return prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        status: data.status ?? 'TODO',
        priority: data.priority ?? 'MEDIUM',
        assignedTo: data.assignedTo ?? null,
        reporterId: data.reporterId ?? null,
        dueDate: data.dueDate ? parseDueDate(data.dueDate) : null,
        sprintId: data.sprintId ?? null,
        estimatedHours: data.estimatedHours ?? null,
        actualHours: data.actualHours ?? null,
        order: data.order ?? nextOrder,
        tags: data.tags ?? [],
        // La votación corre en paralelo al trabajo, y en el backlog corre
        // incluso antes de que la tarea tenga dueño.
        valuationStatus: 'VOTING',
        votingClosesAt: lifecycle.votingClosesAt,
        completionStatus: 'PENDING',
      },
      include: taskInclude,
    })
  },

  async update(id: string, data: UpdateTaskDTO) {
    return prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status, completed: data.status === 'DONE' }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
        ...(data.reporterId !== undefined && { reporterId: data.reporterId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? parseDueDate(data.dueDate) : null }),
        ...(data.sprintId !== undefined && { sprintId: data.sprintId }),
        ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
        ...(data.actualHours !== undefined && { actualHours: data.actualHours }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
      include: taskInclude,
    })
  },

  async delete(id: string) {
    return prisma.task.delete({ where: { id } })
  },

  async reorder(tasks: { id: string; order: number; status: TaskStatus }[]) {
    return prisma.$transaction(
      tasks.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: { order: t.order, status: t.status, completed: t.status === 'DONE' },
        })
      )
    )
  },

  async getKanbanBoard(projectId: string, sprintId?: string) {
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        // "backlog" son las que todavía no entran en ninguna caja de tiempo.
        ...(sprintId ? { sprintId: sprintId === 'backlog' ? null : sprintId } : {}),
      },
      include: taskInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    const columns: Record<TaskStatus, typeof tasks> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
      BLOCKED: [],
    }

    for (const task of tasks) {
      columns[task.status].push(task)
    }

    return columns
  },
}
