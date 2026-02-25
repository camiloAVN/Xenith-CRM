import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskService } from '@/lib/services/task.service'
import { ReorderTasksSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// PUT /api/v1/projects/[id]/tasks/reorder
export async function PUT(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { tasks } = ReorderTasksSchema.parse(body)

    await taskService.reorderTasks(tasks)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error reordering tasks:', error)
    return NextResponse.json({ error: 'Error al reordenar tareas' }, { status: 500 })
  }
}
