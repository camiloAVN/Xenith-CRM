import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskCompletionService } from '@/lib/services/task-completion.service'
import { TaskPermissionError } from '@/lib/services/task.service'

/**
 * POST /api/v1/projects/[id]/tasks/[taskId]/reopen
 *
 * Reabre una tarea ya aceptada. El crédito de puntos se revierte con un asiento
 * negativo en el ledger — nunca se borra el original — así que el reparto se
 * recalcula solo y la reversión queda auditable.
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
    const reason = typeof body?.reason === 'string' ? body.reason : null

    const result = await taskCompletionService.reopen(
      taskId,
      session.user.id as string,
      reason
    )

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error reopening task:', error)
    return NextResponse.json({ error: 'Error al reabrir la tarea' }, { status: 500 })
  }
}
