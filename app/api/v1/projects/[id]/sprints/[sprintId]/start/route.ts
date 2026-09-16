import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sprintService } from '@/lib/services/sprint.service'
import { TaskPermissionError } from '@/lib/services/task.service'

/**
 * POST /api/v1/projects/[id]/sprints/[sprintId]/start
 *
 * Arranca el sprint. Solo puede haber uno corriendo por proyecto: si hay otro
 * activo, hay que cerrarlo primero.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sprintId } = await params
    const sprint = await sprintService.start(sprintId, session.user.id as string)

    return NextResponse.json(sprint)
  } catch (error) {
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error al arrancar el sprint:', error)
    return NextResponse.json({ error: 'Error al arrancar el sprint' }, { status: 500 })
  }
}
