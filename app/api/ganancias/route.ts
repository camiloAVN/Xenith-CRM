import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const createSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number({ error: 'El monto es requerido' }),
  type: z.enum(['COMPANY_INCOME', 'DEDUCTION', 'USER_EARNING']),
  projectId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  const isSuperAdmin = dbUser?.role === 'SUPERADMIN'

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (isSuperAdmin) {
    // SUPERADMIN: devuelve todo
    const where = projectId ? { projectId } : {}
    const earnings = await prisma.earning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })
    return NextResponse.json(earnings)
  }

  // Proyectos donde el usuario es miembro o líder — fuente de verdad para todos los filtros
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [
        { assignedTo: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    select: { id: true, title: true },
  })
  const userProjectIds = userProjects.map((p) => p.id)

  // Sin proyectos asociados → sin acceso a ninguna ganancia
  if (userProjectIds.length === 0) {
    return NextResponse.json({ myEarnings: [], projectTotals: [], allowedProjects: [] })
  }

  // Si piden un proyecto específico que no les pertenece → vacío
  if (projectId && !userProjectIds.includes(projectId)) {
    return NextResponse.json({ myEarnings: [], projectTotals: [], allowedProjects: userProjects })
  }

  const pidFilter = projectId
    ? { equals: projectId }
    : { in: userProjectIds }

  // Ganancias personales del usuario, solo de sus proyectos
  const myEarnings = await prisma.earning.findMany({
    where: {
      type: 'USER_EARNING',
      userId: session.user.id,
      projectId: pidFilter,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, title: true } },
    },
  })

  // Ingresos por proyecto (solo proyectos asociados al usuario)
  const incomeByProject = await prisma.earning.groupBy({
    by: ['projectId'],
    where: { type: 'COMPANY_INCOME', projectId: pidFilter },
    _sum: { amount: true },
  })

  // Deducciones por proyecto
  const deductionByProject = await prisma.earning.groupBy({
    by: ['projectId'],
    where: { type: 'DEDUCTION', projectId: pidFilter },
    _sum: { amount: true },
  })

  const involvedProjectIds = [
    ...new Set([
      ...incomeByProject.map((p) => p.projectId),
      ...deductionByProject.map((p) => p.projectId),
    ]),
  ].filter((id): id is string => id !== null)

  // Neto por proyecto = ingresos - abs(deducciones)
  const projectTotalsWithTitle = involvedProjectIds.map((pid) => {
    const income = Number(incomeByProject.find((p) => p.projectId === pid)?._sum.amount ?? 0)
    const deductions = Math.abs(Number(deductionByProject.find((p) => p.projectId === pid)?._sum.amount ?? 0))
    return {
      projectId: pid,
      title: userProjects.find((p) => p.id === pid)?.title ?? 'Proyecto desconocido',
      income,
      deductions,
      total: income - deductions,
    }
  })

  return NextResponse.json({ myEarnings, projectTotals: projectTotalsWithTitle, allowedProjects: userProjects })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Solo el SUPERADMIN puede crear registros' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { description, amount, type, projectId, userId } = parsed.data

  const earning = await prisma.earning.create({
    data: {
      description,
      amount,
      type,
      projectId: projectId || null,
      userId: type === 'USER_EARNING' ? (userId || null) : null,
    },
    include: {
      project: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(earning, { status: 201 })
}
