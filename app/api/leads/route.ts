import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { LEAD_STATUSES, LeadStatus } from '@/lib/validations/lead'

// GET /api/leads - Lista las solicitudes del formulario público
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') || ''

    const where: Prisma.ContactRequestWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (LEAD_STATUSES.includes(status as LeadStatus)) {
      where.status = status as LeadStatus
    }

    // Los conteos ignoran el filtro de estado a propósito: son las pestañas de
    // navegación, así que deben mostrar siempre el total de cada estado.
    const [leads, grouped] = await Promise.all([
      prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contactRequest.groupBy({
        by: ['status'],
        where: search ? { OR: where.OR } : {},
        _count: { status: true },
      }),
    ])

    const counts = Object.fromEntries(
      LEAD_STATUSES.map((s) => [
        s,
        grouped.find((g) => g.status === s)?._count.status ?? 0,
      ])
    ) as Record<LeadStatus, number>

    return NextResponse.json({
      leads,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Error al obtener los leads' },
      { status: 500 }
    )
  }
}
