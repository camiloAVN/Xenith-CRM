import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z, ZodError } from 'zod'
import { contributionService } from '@/lib/services/contribution.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { getProjectPermissions, getProjectMemberIds } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'

const CreateAdjustmentSchema = z.object({
  userId: z.string().min(1, 'Debes escoger a quién darle los puntos'),
  points: z.number().refine((n) => n !== 0, 'Los puntos no pueden ser cero'),
  note: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/v1/projects/[id]/contributions/adjustments
 *
 * Ajustes manuales del proyecto y la lista de participantes a los que se les
 * puede asignar. Visible para todo el equipo: si el dueño reparte puntos a
 * mano, el equipo tiene que poder verlo.
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

    const [adjustments, memberIds] = await Promise.all([
      contributionService.listAdjustments(id),
      getProjectMemberIds(id),
    ])

    const participants = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      adjustments,
      participants,
      canAdjust: perms.isOwner,
    })
  } catch (error) {
    console.error('Error fetching adjustments:', error)
    return NextResponse.json({ error: 'Error al obtener los ajustes' }, { status: 500 })
  }
}

/**
 * POST /api/v1/projects/[id]/contributions/adjustments
 *
 * Otorga (o descuenta) puntos a mano. Exclusivo del dueño: es la única acción
 * que mueve el reparto sin pasar por votación ni aprobación.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const perms = await getProjectPermissions(id, session.user.id as string)
    if (!perms.isOwner) {
      return NextResponse.json(
        { error: 'Solo el dueño puede asignar puntos manualmente' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, points, note } = CreateAdjustmentSchema.parse(body)

    const entry = await contributionService.createAdjustment(
      id,
      userId,
      points,
      note ?? null,
      session.user.id as string
    )

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error creating adjustment:', error)
    return NextResponse.json({ error: 'Error al asignar los puntos' }, { status: 500 })
  }
}
