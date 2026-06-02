import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().optional(),
  type: z.enum(['COMPANY_INCOME', 'DEDUCTION', 'USER_EARNING']).optional(),
  projectId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
})

async function requireSuperAdmin(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return dbUser?.role === 'SUPERADMIN'
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await requireSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Solo el SUPERADMIN puede editar registros' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { type, userId, ...rest } = parsed.data

  const earning = await prisma.earning.update({
    where: { id },
    data: {
      ...rest,
      ...(type !== undefined ? { type } : {}),
      userId: type === 'USER_EARNING' ? (userId ?? null) : null,
    },
    include: {
      project: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(earning)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await requireSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Solo el SUPERADMIN puede eliminar registros' }, { status: 403 })
  }

  const { id } = await params
  await prisma.earning.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
