import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sprintService } from '@/lib/services/sprint.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { getProjectPermissions } from '@/lib/auth/permissions'
import { UpdateSprintSchema, SetCapacitySchema } from '@/lib/dto/sprint.dto'
import { ZodError } from 'zod'

/** GET — el sprint con su tablero de capacidad. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, sprintId } = await params
    const perms = await getProjectPermissions(id, session.user.id as string)
    if (!perms.isMember && !perms.isOwner) {
      return NextResponse.json({ error: 'No perteneces a este proyecto' }, { status: 403 })
    }

    const capacities = await sprintService.getCapacities(sprintId)
    return NextResponse.json({ capacities })
  } catch (error) {
    console.error('Error al obtener el sprint:', error)
    return NextResponse.json({ error: 'Error al obtener el sprint' }, { status: 500 })
  }
}

/** PUT — edita nombre, meta o fechas; o ajusta la capacidad de una persona. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sprintId } = await params
    const body = await request.json()
    const userId = session.user.id as string

    // Dos operaciones por la misma ruta: el cuerpo con `userId` + `points` es
    // un ajuste de capacidad; cualquier otro, una edición del sprint.
    if ('userId' in body && 'points' in body) {
      const data = SetCapacitySchema.parse(body)
      const row = await sprintService.setCapacity(sprintId, data.userId, data.points, userId)
      return NextResponse.json(row)
    }

    const data = UpdateSprintSchema.parse(body)
    const sprint = await sprintService.update(sprintId, data, userId)
    return NextResponse.json(sprint)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error al actualizar el sprint:', error)
    return NextResponse.json({ error: 'Error al actualizar el sprint' }, { status: 500 })
  }
}
