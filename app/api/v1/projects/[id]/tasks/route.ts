import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskService } from '@/lib/services/task.service'
import { CreateTaskSchema, TaskFiltersSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// GET /api/v1/projects/[id]/tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { searchParams } = new URL(request.url)

    const filters = TaskFiltersSchema.parse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      assignedTo: searchParams.get('assignedTo') ?? undefined,
      dueDateFrom: searchParams.get('dueDateFrom') ?? undefined,
      dueDateTo: searchParams.get('dueDateTo') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })

    // If requesting kanban board view
    if (searchParams.get('view') === 'kanban') {
      const board = await taskService.getKanbanBoard(id)
      return NextResponse.json(board)
    }

    const tasks = await taskService.getTasksByProject(id, filters)
    return NextResponse.json(tasks)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Filtros inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 })
  }
}

// POST /api/v1/projects/[id]/tasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const validatedData = CreateTaskSchema.parse(body)

    const task = await taskService.createTask(id, validatedData, session.user.id as string)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
