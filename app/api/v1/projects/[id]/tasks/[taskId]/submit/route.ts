import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskService, TaskPermissionError } from '@/lib/services/task.service'

/**
 * POST /api/v1/projects/[id]/tasks/[taskId]/submit
 *
 * El asignado marca su tarea como terminada. La tarea queda esperando la
 * aceptación de los jefes y el reloj de retraso se pausa aquí — no cuando los
 * jefes revisan — para no castigar al trabajador por la demora de la revisión.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const task = await taskService.submitCompletion(taskId, session.user.id as string)

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error submitting task:', error)
    return NextResponse.json({ error: 'Error al marcar la tarea como terminada' }, { status: 500 })
  }
}
