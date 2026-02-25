import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { hash } from 'bcrypt'
import { createUserSchema, SUPERADMIN_EMAIL } from '@/lib/validations/user'
import { ZodError } from 'zod'

// Helper to check if user is superadmin
async function isSuperAdmin(session: any): Promise<boolean> {
  if (!session?.user?.email) return false
  return session.user.email === SUPERADMIN_EMAIL
}

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const forSelect = searchParams.get('forSelect') === 'true'

    // Si es para select (dropdown), devolver solo id, name, email
    if (forSelect) {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(users)
    }

    // Para la lista completa, solo superadmin
    if (!await isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create new user (superadmin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo superadmin puede crear usuarios
    if (!await isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Verificar que el email no exista
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este email' },
        { status: 400 }
      )
    }

    // No permitir crear otro SUPERADMIN
    if (validatedData.role === 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'No se puede crear otro superadmin' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hash(validatedData.password, 12)

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email.toLowerCase(),
        password: hashedPassword,
        role: validatedData.role,
        position: validatedData.position ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    console.info(`[ADMIN] User created: ${user.email} by ${session.user.email}`)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos invalidos', issues: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Error al crear usuario' },
      { status: 500 }
    )
  }
}
