import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma as db } from '@/lib/db/prisma'
import { getProjectPermissions, PROJECT_LEAD_ROLES } from '@/lib/auth/permissions'
import { z, ZodError } from 'zod'

const UpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER']),
})

// PUT /api/v1/projects/[id]/members/[userId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, userId } = await params
    const body = await request.json()
    const { role } = UpdateRoleSchema.parse(body)

    const perms = await getProjectPermissions(id, session.user.id as string)
    if (!perms.canManageMembers) {
      return NextResponse.json({ error: 'No tienes permisos para cambiar roles' }, { status: 403 })
    }

    const current = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
      select: { role: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Nombrar un jefe o destituirlo es exclusivo del dueño. Un jefe sí puede
    // mover roles entre DEVELOPER y VIEWER dentro de su equipo.
    const touchesLeadRole =
      PROJECT_LEAD_ROLES.includes(role) || PROJECT_LEAD_ROLES.includes(current.role)
    if (touchesLeadRole && !perms.canManageLeads) {
      return NextResponse.json(
        { error: 'Solo el dueño puede nombrar o destituir jefes de proyecto' },
        { status: 403 }
      )
    }

    const member = await db.projectMember.update({
      where: { projectId_userId: { projectId: id, userId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json(member)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating member role:', error)
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 })
  }
}

// DELETE /api/v1/projects/[id]/members/[userId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, userId } = await params
    const perms = await getProjectPermissions(id, session.user.id as string)
    if (!perms.canManageMembers) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar miembros' }, { status: 403 })
    }

    const current = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
      select: { role: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (PROJECT_LEAD_ROLES.includes(current.role) && !perms.canManageLeads) {
      return NextResponse.json(
        { error: 'Solo el dueño puede destituir jefes de proyecto' },
        { status: 403 }
      )
    }

    // El ledger de puntos NO se toca: lo ganado queda ganado y su saldo se
    // congela. PointLedgerEntry apunta a User, no a ProjectMember.
    await db.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Error al eliminar miembro' }, { status: 500 })
  }
}
