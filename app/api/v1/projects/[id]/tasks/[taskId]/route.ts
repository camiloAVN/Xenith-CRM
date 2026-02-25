import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskService } from '@/lib/services/task.service'
import { UpdateTaskSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// GET /api/v1/projects/[id]/tasks/[taskId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const task = await taskService.getTaskById(taskId)

    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Error al obtener tarea' }, { status: 500 })
  }
}

// PUT /api/v1/projects/[id]/tasks/[taskId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const body = await request.json()
    const validatedData = UpdateTaskSchema.parse(body)

    const task = await taskService.updateTask(taskId, validatedData, session.user.id as string)
    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
  }
}

// DELETE /api/v1/projects/[id]/tasks/[taskId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    await taskService.deleteTask(taskId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 })
  }
}
