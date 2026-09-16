import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sprintService } from '@/lib/services/sprint.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { getProjectPermissions } from '@/lib/auth/permissions'
import { CreateSprintSchema } from '@/lib/dto/sprint.dto'
import { ZodError } from 'zod'

/**
 * GET /api/v1/projects/[id]/sprints
 *
 * Todos los sprints del proyecto y, si hay uno corriendo, su tablero de
 * capacidad: quién se comprometió a cuánto y cuánto lleva aceptado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const perms = await getProjectPermissions(id, session.user.id as string)
    if (!perms.isMember && !perms.isOwner) {
      return NextResponse.json({ error: 'No perteneces a este proyecto' }, { status: 403 })
    }

    const [sprints, active] = await Promise.all([
      sprintService.list(id),
      sprintService.getActive(id),
    ])
    const capacities = active ? await sprintService.getCapacities(active.id) : []

    return NextResponse.json({ sprints, active, capacities, permissions: perms })
  } catch (error) {
    console.error('Error al obtener sprints:', error)
    return NextResponse.json({ error: 'Error al obtener los sprints' }, { status: 500 })
  }
}

/** POST /api/v1/projects/[id]/sprints — crea un sprint (solo jefes). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const data = CreateSprintSchema.parse(await request.json())
    const sprint = await sprintService.create(id, data, session.user.id as string)

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error al crear el sprint:', error)
    return NextResponse.json({ error: 'Error al crear el sprint' }, { status: 500 })
  }
}
