import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { payoutService } from '@/lib/services/payout.service'
import { TaskPermissionError } from '@/lib/services/task.service'
import { getProjectPermissions } from '@/lib/auth/permissions'
import { CreatePayoutSchema } from '@/lib/dto/payout.dto'
import { ZodError } from 'zod'

/**
 * GET /api/v1/projects/[id]/payouts
 *
 * Lo ya liquidado (congelado) y la foto de lo que pasaría si se liquidara hoy
 * lo que falta. Lo ve todo el equipo: el reparto es público entre los tres.
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

    const [payouts, preview] = await Promise.all([
      payoutService.list(id),
      payoutService.preview(id),
    ])

    return NextResponse.json({ payouts, preview, canLiquidate: perms.isOwner })
  } catch (error) {
    console.error('Error al obtener las liquidaciones:', error)
    return NextResponse.json({ error: 'Error al obtener las liquidaciones' }, { status: 500 })
  }
}

/** POST — liquida y congela el reparto. Solo el dueño. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const data = CreatePayoutSchema.parse(await request.json())
    const payout = await payoutService.create(id, data, session.user.id as string)

    return NextResponse.json(payout, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    if (error instanceof TaskPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Error al liquidar:', error)
    return NextResponse.json({ error: 'Error al liquidar el proyecto' }, { status: 500 })
  }
}
