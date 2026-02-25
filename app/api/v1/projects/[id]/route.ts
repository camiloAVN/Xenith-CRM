import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { projectSchema } from '@/lib/validations/project'
import { projectService } from '@/lib/services/project.service'
import { ZodError } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const projectInclude = {
  client: { select: { id: true, name: true, company: true, email: true, phone: true } },
  assignedUser: { select: { id: true, name: true, email: true } },
  tasks: { orderBy: { order: 'asc' as const } },
  quotations: { orderBy: { createdAt: 'desc' as const } },
  members: {
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  },
}

// GET /api/v1/projects/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id }, include: projectInclude })

    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Error al obtener proyecto' }, { status: 500 })
  }
}

// PUT /api/v1/projects/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    // If closing the project, validate pending tasks
    if (body.status === 'COMPLETED') {
      try {
        await projectService.closeProject(id)
        return NextResponse.json({ success: true })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Error al cerrar proyecto' },
          { status: 422 }
        )
      }
    }

    const validatedData = projectSchema.parse(body)
    const budget = validatedData.budget ? new Decimal(validatedData.budget) : null

    const project = await prisma.project.update({
      where: { id },
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
      include: projectInclude,
    })

    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 })
  }
}

// DELETE /api/v1/projects/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error al eliminar proyecto' }, { status: 500 })
  }
}
