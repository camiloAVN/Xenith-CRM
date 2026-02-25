import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { projectService } from '@/lib/services/project.service'

// GET /api/v1/projects/[id]/progress
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const progress = await projectService.getProgress(id)

    return NextResponse.json(progress)
  } catch (error) {
    console.error('Error fetching project progress:', error)
    return NextResponse.json({ error: 'Error al obtener progreso' }, { status: 500 })
  }
}
