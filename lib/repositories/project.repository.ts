import { prisma } from '@/lib/db/prisma'
import { ProjectProgressDTO } from '@/lib/dto/project.dto'

export const projectRepository = {
  async getProgress(projectId: string): Promise<ProjectProgressDTO> {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: { status: true, estimatedHours: true, actualHours: true },
    })

    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'DONE').length
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const review = tasks.filter((t) => t.status === 'REVIEW').length
    const blocked = tasks.filter((t) => t.status === 'BLOCKED').length
    const todo = tasks.filter((t) => t.status === 'TODO').length
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100)

    const estimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
    const actualHours = tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0)

    return { total, done, inProgress, review, blocked, todo, percentage, estimatedHours, actualHours }
  },
}
