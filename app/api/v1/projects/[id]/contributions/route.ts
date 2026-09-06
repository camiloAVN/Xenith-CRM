import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { contributionService } from '@/lib/services/contribution.service'
import { getProjectPermissions } from '@/lib/auth/permissions'

/**
 * GET /api/v1/projects/[id]/contributions
 *
 * Puntos, porcentaje y reparto de cada persona en el proyecto. Se recalcula en
 * vivo desde el ledger en cada petición: no hay ningún total cacheado que
 * pueda quedar desfasado.
 *
 * Visible para todo el equipo del proyecto — la transparencia del reparto es
 * el punto del sistema.
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
      return NextResponse.json(
        { error: 'Solo los miembros del proyecto pueden ver el reparto' },
        { status: 403 }
      )
    }

    const contributions = await contributionService.getProjectContributions(id)
    return NextResponse.json(contributions)
  } catch (error) {
    console.error('Error fetching contributions:', error)
    return NextResponse.json({ error: 'Error al obtener los aportes' }, { status: 500 })
  }
}
