import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskOverdueService } from '@/lib/services/task-overdue.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { RevaluationSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

/**
 * POST /api/v1/projects/[id]/tasks/[taskId]/revaluation
 *
 * Sin cuerpo (o `{ reason }`): el asignado PIDE revaluación — la tarea entra en
 * pausa y les llega correo a los jefes.
 *
 * Con `{ resolve: true, newDueDate?, reopenVoting? }`: un jefe la RESUELVE —
 * pone fecha nueva y, si el equipo lo ve distinto, reabre la votación de
 * puntos. La tarea sale de pausa.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const body = await request.json().catch(() => ({}))
    const data = RevaluationSchema.parse(body)
    const userId = session.user.id as string

    const task = data.resolve
      ? await taskOverdueService.resolveRevaluation(taskId, userId, {
          newDueDate: data.newDueDate,
          reopenVoting: data.reopenVoting,
        })
      : await taskOverdueService.requestRevaluation(taskId, userId, data.reason ?? undefined)

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error en la revaluación:', error)
    return NextResponse.json({ error: 'Error al procesar la revaluación' }, { status: 500 })
  }
}
