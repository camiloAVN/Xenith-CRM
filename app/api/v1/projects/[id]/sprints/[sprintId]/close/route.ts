import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sprintService } from '@/lib/services/sprint.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { CloseSprintSchema } from '@/lib/dto/sprint.dto'
import { ZodError } from 'zod'

/**
 * POST /api/v1/projects/[id]/sprints/[sprintId]/close
 *
 * Cierra el sprint y arrastra lo que no se aceptó al sprint destino (o al
 * backlog). Cada arrastre queda contado en la tarea y descuenta al acreditarla:
 * es lo que hace que la caja de tiempo signifique algo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sprintId } = await params
    const body = await request.json().catch(() => ({}))
    const data = CloseSprintSchema.parse(body)

    const result = await sprintService.close(
      sprintId,
      { nextSprintId: data.nextSprintId ?? null },
      session.user.id as string
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error al cerrar el sprint:', error)
    return NextResponse.json({ error: 'Error al cerrar el sprint' }, { status: 500 })
  }
}
