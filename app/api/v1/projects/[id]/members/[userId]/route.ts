import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma as db } from '@/lib/db/prisma'
import { z, ZodError } from 'zod'

const UpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER']),
})

async function isAdminOrSuperAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
  return user?.role === 'SUPERADMIN' || user?.role === 'ADMIN'
}

// PUT /api/v1/projects/[id]/members/[userId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isAdminOrSuperAdmin(session.user.id as string))) {
      return NextResponse.json({ error: 'No tienes permisos para cambiar roles' }, { status: 403 })
    }

    const { id, userId } = await params
    const body = await request.json()
    const { role } = UpdateRoleSchema.parse(body)

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
    if (!(await isAdminOrSuperAdmin(session.user.id as string))) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar miembros' }, { status: 403 })
    }

    const { id, userId } = await params
    await db.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Error al eliminar miembro' }, { status: 500 })
  }
}
