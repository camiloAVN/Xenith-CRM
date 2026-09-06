import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { contributionMetricsService } from '@/lib/services/contribution-metrics.service'
import { getProjectPermissions } from '@/lib/auth/permissions'

/**
 * GET /api/v1/projects/[id]/contributions/metrics
 *
 * Serie mensual de puntos por persona, mes más productivo de cada quien y
 * tendencia de rendimiento. Alimenta la ventana de gráficos del proyecto.
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
        { error: 'Solo los miembros del proyecto pueden ver estas métricas' },
        { status: 403 }
      )
    }

    const metrics = await contributionMetricsService.getProjectMetrics(id)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching contribution metrics:', error)
    return NextResponse.json({ error: 'Error al obtener las métricas' }, { status: 500 })
  }
}
