import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

// GET /api/v1/projects/[id]/tasks/[taskId]/attachments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { taskId } = await params
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json({ error: 'Error al obtener adjuntos' }, { status: 500 })
  }
}

// POST /api/v1/projects/[id]/tasks/[taskId]/attachments — stub
export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ id: string; taskId: string }> }
) {
  return NextResponse.json(
    { error: 'La subida de archivos aún no está implementada' },
    { status: 501 }
  )
}
