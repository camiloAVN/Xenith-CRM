import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { projectSchema } from '@/lib/validations/project'
import { ZodError } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// GET /api/projects - List all projects with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const clientId = searchParams.get('clientId')
    const assignedTo = searchParams.get('assignedTo')

    const where: any = {}

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Status filter
    if (status) {
      where.status = status
    }

    // Priority filter
    if (priority) {
      where.priority = priority
    }

    // Client filter
    if (clientId) {
      where.clientId = clientId
    }

    // Assigned user filter
    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = projectSchema.parse(body)

    // Convert budget string to Decimal if provided
    const budget = validatedData.budget ? new Decimal(validatedData.budget) : null

    const project = await prisma.project.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        clientId: validatedData.clientId,
        assignedTo: validatedData.assignedTo,
        priority: validatedData.priority,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : null,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        budget,
        tags: validatedData.tags || [],
        notes: validatedData.notes || null,
      },
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    })

    // Crear miembros del proyecto
    const { memberIds = [], assignedTo } = validatedData
    // IDs únicos: líder como PROJECT_MANAGER + resto como DEVELOPER
    const uniqueMemberIds = [...new Set(memberIds.filter((id) => id !== assignedTo))]
    const memberRecords = [
      { projectId: project.id, userId: assignedTo, role: 'PROJECT_MANAGER' as const },
      ...uniqueMemberIds.map((userId) => ({
        projectId: project.id,
        userId,
        role: 'DEVELOPER' as const,
      })),
    ]
    if (memberRecords.length > 0) {
      await prisma.projectMember.createMany({ data: memberRecords, skipDuplicates: true })
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Error al crear proyecto' },
      { status: 500 }
    )
  }
}
