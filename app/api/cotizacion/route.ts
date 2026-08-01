import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { cotizacionSchema } from '@/lib/validations/cotizacion'
import { internalNotificationEmail, thankYouEmail } from '@/lib/email/templates'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getClientIP } from '@/lib/security/get-client-ip'

const resend = new Resend(process.env.RESEND_API_KEY)

const TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'camilo.vargas@xenith.com.co'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Xenith <contacto@xenith.com.co>'

/**
 * Límite por IP. Es un backstop contra inundaciones, NO una cuota por persona:
 * en una feria todos los asistentes comparten la IP del wifi del recinto, así
 * que va deliberadamente alto para no bloquear leads reales. Configurable por
 * entorno para poder subirlo aún más esos días sin tocar código.
 */
const RATE_LIMIT = {
  maxAttempts: Number(process.env.CONTACT_RATE_LIMIT_MAX) || 20,
  windowMs: (Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MIN) || 60) * 60 * 1000,
}

/**
 * Ventana anti-duplicados por correo. Cubre el doble clic y el reenvío
 * accidental. No es un bloqueo permanente a propósito: un cliente que escribió
 * hace meses tiene todo el derecho a volver a consultar por otro proyecto.
 */
const EMAIL_COOLDOWN_MS =
  (Number(process.env.CONTACT_EMAIL_COOLDOWN_MIN) || 10) * 60 * 1000

/** Convierte '' en undefined para no guardar cadenas vacías en la DB. */
const clean = (v: unknown) =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

export async function POST(req: NextRequest) {
  // Se comprueba antes de parsear el cuerpo: una petición bloqueada no debe
  // costar ni trabajo de validación ni una escritura en la base.
  const ip = getClientIP(req)
  const limit = checkRateLimit(`cotizacion:${ip}`, RATE_LIMIT)

  if (!limit.success) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetTime - Date.now()) / 1000))
    return NextResponse.json(
      {
        ok: false,
        error: 'Ya recibimos varias solicitudes tuyas. Espera un momento o escríbenos directamente a ' + TO_EMAIL + '.',
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  let data

  try {
    const body = await req.json()
    data = cotizacionSchema.parse({
      name: clean(body.name),
      // En minúsculas para que la deduplicación no dependa de cómo lo escriban.
      email: clean(body.email)?.toLowerCase(),
      phone: clean(body.phone),
      company: clean(body.company),
      message: clean(body.message),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Solicitud malformada' }, { status: 400 })
  }

  // Anti-duplicados por correo. A diferencia del límite por IP (que vive en
  // memoria y se reinicia con cada instancia serverless), esto consulta la base
  // y por tanto es confiable en Vercel.
  try {
    const reciente = await prisma.contactRequest.findFirst({
      where: {
        email: data.email,
        createdAt: { gte: new Date(Date.now() - EMAIL_COOLDOWN_MS) },
      },
      select: { id: true },
    })

    // Idempotente: casi siempre es un doble clic. Se le muestra éxito —porque
    // su solicitud sí está registrada— pero no duplicamos fila ni correos.
    if (reciente) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  } catch (err) {
    // Si la consulta falla, seguimos adelante: es preferible un duplicado
    // ocasional a perder el lead.
    console.error('[cotizacion] chequeo de duplicado:', err)
  }

  // Las tres operaciones son independientes: si una falla, las otras deben
  // completarse igual. Perder un lead por un fallo de correo no es aceptable.
  const [saved, notified, thanked] = await Promise.allSettled([
    prisma.contactRequest.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        company: data.company ?? null,
        message: data.message ?? null,
      },
    }),

    resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: data.email,
      subject: `[Cotización] ${data.name}${data.company ? ` — ${data.company}` : ''}`,
      html: internalNotificationEmail(data),
    }),

    resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      replyTo: TO_EMAIL,
      subject: 'Gracias por contactarnos — Xenith',
      html: thankYouEmail(data),
    }),
  ])

  if (saved.status === 'rejected') console.error('[cotizacion] DB:', saved.reason)
  if (notified.status === 'rejected') console.error('[cotizacion] aviso interno:', notified.reason)
  if (thanked.status === 'rejected') console.error('[cotizacion] agradecimiento:', thanked.reason)

  // Solo es un error real si no quedó rastro alguno de la solicitud.
  if (saved.status === 'rejected' && notified.status === 'rejected') {
    return NextResponse.json({ ok: false, error: 'Error al enviar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
