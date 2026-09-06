import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { taskValuationService } from '@/lib/services/task-valuation.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { CastVoteSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// GET /api/v1/projects/[id]/tasks/[taskId]/votes — estado de la votación
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params

    // Cierre perezoso: si la ventana ya venció, se liquida antes de responder
    // para que nadie vea "abierta" una votación que en realidad expiró.
    await taskValuationService.settleTask(taskId).catch(console.error)

    const state = await taskValuationService.getVotingState(taskId, session.user.id as string)
    return NextResponse.json(state)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Error fetching voting state:', error)
    return NextResponse.json({ error: 'Error al obtener la votación' }, { status: 500 })
  }
}

// POST /api/v1/projects/[id]/tasks/[taskId]/votes — votar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const body = await request.json()
    const { value } = CastVoteSchema.parse(body)

    // Liquidar primero: si la ventana venció mientras el panel estaba abierto,
    // el voto se rechaza en vez de colarse sobre una votación ya cerrada.
    await taskValuationService.settleTask(taskId).catch(console.error)

    await taskValuationService.castVote(taskId, session.user.id as string, value)
    const state = await taskValuationService.getVotingState(taskId, session.user.id as string)

    return NextResponse.json(state, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Voto inválido', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error casting vote:', error)
    return NextResponse.json({ error: 'Error al registrar el voto' }, { status: 500 })
  }
}
