import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcrypt'
import { prisma } from '@/lib/db/prisma'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/security/rate-limiter'
import { z } from 'zod'

const setupSchema = z.object({
  setupKey: z.string().min(1, 'Setup key is required'),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
})

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  if (forwarded) return forwarded.split(',')[0].trim()
  if (realIP) return realIP
  return 'unknown'
}

export async function POST(request: NextRequest) {
  // Disable this endpoint entirely in production once setup is done
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_SETUP_DISABLED === 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const clientIP = getClientIP(request)

  // Rate limit: 3 attempts per hour per IP
  const rateLimitResult = checkRateLimit(
    `register-admin:${clientIP}`,
    RATE_LIMIT_CONFIGS.passwordReset
  )

  if (!rateLimitResult.success) {
    console.warn(`[SECURITY] Rate limit exceeded on register-admin from IP: ${clientIP}`)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { setupKey, email, password } = setupSchema.parse(body)

    // Verify setup key
    const validSetupKey = process.env.ADMIN_SETUP_KEY
    if (!validSetupKey || setupKey !== validSetupKey) {
      console.warn(`[SECURITY] Failed admin setup attempt from IP: ${clientIP}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminEmail = email || process.env.ADMIN_EMAIL
    const adminPassword = password || process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Admin credentials not configured' },
        { status: 500 }
      )
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(adminPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Admin user already exists' }, { status: 400 })
    }

    const hashedPassword = await hash(adminPassword, 12)

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin XENITH',
        password: hashedPassword,
      },
    })

    console.info(`[SECURITY] Admin user created: ${user.email} from IP: ${clientIP}`)

    return NextResponse.json({
      message: 'Admin user created successfully',
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('[ERROR] Error creating admin user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
