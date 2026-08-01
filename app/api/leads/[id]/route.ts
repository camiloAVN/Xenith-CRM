import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { updateLeadSchema } from '@/lib/validations/lead'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

// PATCH /api/leads/[id] - Cambia el estado de un lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = updateLeadSchema.parse(body)

    const lead = await prisma.contactRequest.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json(lead)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Estado inválido', issues: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el lead' },
      { status: 500 }
    )
  }
}

// DELETE /api/leads/[id] - Elimina un lead (spam, pruebas)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.contactRequest.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el lead' },
      { status: 500 }
    )
  }
}
