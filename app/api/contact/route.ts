import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactSchema } from '@/lib/validations/contact'
import { ZodError } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY)

const TO_EMAIL = 'camilo.vargas@xenith.com.co'
const FROM_EMAIL = 'Xenith Contacto <onboarding@resend.dev>'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = contactSchema.parse(body)

    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: data.email,
      subject: `[Contacto Web] ${data.subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #0f0f0f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Nuevo mensaje desde el sitio web</h2>
          </div>

          <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600; width: 130px; color: #555;">Nombre</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600; color: #555;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                  <a href="mailto:${data.email}" style="color: #7c3aed;">${data.email}</a>
                </td>
              </tr>
              ${data.phone ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600; color: #555;">Teléfono</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.phone}</td>
              </tr>` : ''}
              ${data.company ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600; color: #555;">Empresa</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.company}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: 600; color: #555;">Asunto</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.subject}</td>
              </tr>
            </table>

            <div style="margin-top: 24px;">
              <p style="font-weight: 600; color: #555; margin-bottom: 8px;">Mensaje</p>
              <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px; white-space: pre-wrap; line-height: 1.6;">${data.message}</div>
            </div>

            <p style="margin-top: 24px; font-size: 12px; color: #999;">
              Puedes responder directamente a este correo para contactar a ${data.name}.
            </p>
          </div>
        </div>
      `,
    })

    return NextResponse.json(
      { success: true, message: 'Mensaje enviado correctamente' },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: 'Datos de formulario inválidos', errors: error.issues },
        { status: 400 }
      )
    }

    console.error('Contact form error:', error)

    return NextResponse.json(
      { success: false, message: 'Error al procesar el mensaje' },
      { status: 500 }
    )
  }
}
