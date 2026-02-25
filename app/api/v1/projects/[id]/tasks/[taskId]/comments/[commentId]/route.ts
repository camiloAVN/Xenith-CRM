import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { UpdateCommentSchema } from '@/lib/dto/task.dto'
import { ZodError } from 'zod'

// PUT /api/v1/projects/[id]/tasks/[taskId]/comments/[commentId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string; commentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { commentId } = await params
    const existing = await prisma.taskComment.findUnique({ where: { id: commentId } })

    if (!existing) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 })
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'No tienes permisos para editar este comentario' }, { status: 403 })
    }

    const body = await request.json()
    const { content } = UpdateCommentSchema.parse(body)

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: { content },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })

    return NextResponse.json(comment)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: error.issues }, { status: 400 })
    }
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Error al actualizar comentario' }, { status: 500 })
  }
}

// DELETE /api/v1/projects/[id]/tasks/[taskId]/comments/[commentId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string; commentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { commentId } = await params
    const existing = await prisma.taskComment.findUnique({ where: { id: commentId } })

    if (!existing) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 })
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este comentario' }, { status: 403 })
    }

    await prisma.taskComment.delete({ where: { id: commentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Error al eliminar comentario' }, { status: 500 })
  }
}
