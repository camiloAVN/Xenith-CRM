import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sprintService } from '@/lib/services/sprint.service'
import { getProjectPermissions } from '@/lib/auth/permissions'

/**
 * GET /api/v1/projects/[id]/sprints/velocity
 *
 * Puntos efectivos aceptados por sprint, en total y por persona. Sirve para
 * planear el siguiente sprint y para detectar inflación: si la velocidad sube
 * fuerte sin que salga más producto, lo que creció fueron los estimados.
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

    const sprints = await sprintService.getVelocity(id)
    const closed = sprints.filter((s) => s.status === 'CLOSED')
    const average =
      closed.length > 0
        ? Math.round((closed.reduce((sum, s) => sum + s.points, 0) / closed.length) * 10) / 10
        : null

    return NextResponse.json({ sprints, averageVelocity: average })
  } catch (error) {
    console.error('Error al calcular la velocidad:', error)
    return NextResponse.json({ error: 'Error al calcular la velocidad' }, { status: 500 })
  }
}
