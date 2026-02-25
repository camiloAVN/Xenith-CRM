import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z, ZodError } from 'zod'

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER']).default('DEVELOPER'),
})

async function isAdminOrSuperAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return user?.role === 'SUPERADMIN' || user?.role === 'ADMIN'
}

// GET /api/v1/projects/[id]/members
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, image: true, position: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Error al obtener miembros' }, { status: 500 })
  }
}

// POST /api/v1/projects/[id]/members
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await isAdminOrSuperAdmin(session.user.id as string))) {
      return NextResponse.json({ error: 'No tienes permisos para agregar miembros' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { userId, role } = AddMemberSchema.parse(body)

    const member = await prisma.projectMember.create({
      data: { projectId: id, userId, role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Error al agregar miembro' }, { status: 500 })
  }
}
