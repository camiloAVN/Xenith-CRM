import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskCompletionService } from '@/lib/services/task-completion.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { ReviewCompletionSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// GET /api/v1/projects/[id]/tasks/[taskId]/approvals — estado de aprobación
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const state = await taskCompletionService.getApprovalState(
      taskId,
      session.user.id as string
    )
    return NextResponse.json(state)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Error fetching approval state:', error)
    return NextResponse.json({ error: 'Error al obtener el estado' }, { status: 500 })
  }
}

// POST /api/v1/projects/[id]/tasks/[taskId]/approvals — aprobar o rechazar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const body = await request.json()
    const { approved, comment } = ReviewCompletionSchema.parse(body)

    const result = await taskCompletionService.review(
      taskId,
      session.user.id as string,
      approved,
      comment
    )
    const state = await taskCompletionService.getApprovalState(
      taskId,
      session.user.id as string
    )

    return NextResponse.json({ ...state, ...result }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error reviewing completion:', error)
    return NextResponse.json({ error: 'Error al revisar la tarea' }, { status: 500 })
  }
}
