import { prisma } from '@/lib/db/prisma'
import { projectRepository } from '@/lib/repositories/project.repository'

export const projectService = {
  async getProgress(projectId: string) {
    return projectRepository.getProgress(projectId)
  },

  async closeProject(projectId: string) {
    // Validate no pending tasks
    const pendingTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'] },
      },
      select: { id: true, title: true, status: true },
    })

    if (pendingTasks.length > 0) {
      throw new Error(
        `No se puede cerrar el proyecto: hay ${pendingTasks.length} tarea(s) pendiente(s). Completa o cancela todas las tareas antes de cerrar el proyecto.`
      )
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    })
  },
}
