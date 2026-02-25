import { prisma } from '@/lib/db/prisma'
import { taskRepository } from '@/lib/repositories/task.repository'
import { CreateTaskDTO, UpdateTaskDTO, TaskFiltersDTO } from '@/lib/dto/task.dto'
import { TaskStatus } from '@prisma/client'

const TRACKED_FIELDS = ['status', 'assignedTo', 'dueDate', 'priority'] as const
type TrackedField = (typeof TRACKED_FIELDS)[number]

const FIELD_LABELS: Record<TrackedField, string> = {
  status: 'status',
  assignedTo: 'assigned_to',
  dueDate: 'due_date',
  priority: 'priority',
}

export const taskService = {
  async createTask(projectId: string, data: CreateTaskDTO, currentUserId: string) {
    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, endDate: true },
    })
    if (!project) throw new Error('Proyecto no encontrado')

    // Set reporter to current user if not provided
    const taskData: CreateTaskDTO = {
      ...data,
      reporterId: data.reporterId ?? currentUserId,
    }

    return taskRepository.create(projectId, taskData)
  },

  async updateTask(taskId: string, data: UpdateTaskDTO, currentUserId: string) {
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        status: true,
        assignedTo: true,
        dueDate: true,
        priority: true,
      },
    })
    if (!existing) throw new Error('Tarea no encontrada')

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

  async deleteTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) throw new Error('Tarea no encontrada')
    return taskRepository.delete(taskId)
  },

  async reorderTasks(tasks: { id: string; order: number; status: TaskStatus }[]) {
    return taskRepository.reorder(tasks)
  },

  async getTasksByProject(projectId: string, filters: TaskFiltersDTO) {
    return taskRepository.findMany(projectId, filters)
  },

  async getKanbanBoard(projectId: string) {
    return taskRepository.getKanbanBoard(projectId)
  },

  async getTaskById(taskId: string) {
    return taskRepository.findById(taskId)
  },
}
