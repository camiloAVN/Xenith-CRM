import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY)

const TO_EMAIL = 'camilo.vargas@xenith.com.co'
const FROM_EMAIL = 'Xenith Web <onboarding@resend.dev>'

const cotizacionSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto').max(100),
  email: z.string().email('Email inválido').max(100),
  company: z.string().max(100).optional(),
  type: z.string().min(1, 'Selecciona un tipo de proyecto'),
  message: z.string().min(5, 'Mensaje muy corto').max(3000),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = cotizacionSchema.parse(body)

    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: data.email,
      subject: `[Cotización] ${data.type} — ${data.name}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#05070e;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5aa0ff;margin-bottom:10px;">
            XENITH · ENGINEERING STUDIO
          </p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
            Nueva solicitud de cotización
          </h1>
        </td></tr>

        <!-- Tipo de proyecto badge -->
        <tr><td style="background:#070a13;padding:20px 40px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 18px;background:rgba(47,128,255,0.12);border:1px solid rgba(90,160,255,0.3);border-radius:10px;text-align:center;">
                <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5aa0ff;margin-bottom:4px;">Tipo de proyecto</p>
                <p style="margin:0;font-size:17px;font-weight:700;color:#ffffff;">${data.type}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Datos del contacto -->
        <tr><td style="background:#070a13;padding:8px 40px 24px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;">

            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="padding:14px 18px;background:rgba(255,255,255,0.03);width:120px;">
                <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5d6883;">Nombre</p>
              </td>
              <td style="padding:14px 18px;background:rgba(255,255,255,0.01);">
                <p style="margin:0;font-size:15px;color:#eef2fb;font-weight:600;">${data.name}</p>
              </td>
            </tr>

            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="padding:14px 18px;background:rgba(255,255,255,0.03);">
                <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5d6883;">Email</p>
              </td>
              <td style="padding:14px 18px;background:rgba(255,255,255,0.01);">
                <a href="mailto:${data.email}" style="color:#5aa0ff;font-size:15px;text-decoration:none;">${data.email}</a>
              </td>
            </tr>

            ${data.company ? `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <td style="padding:14px 18px;background:rgba(255,255,255,0.03);">
                <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5d6883;">Empresa</p>
              </td>
              <td style="padding:14px 18px;background:rgba(255,255,255,0.01);">
                <p style="margin:0;font-size:15px;color:#eef2fb;">${data.company}</p>
              </td>
            </tr>` : ''}

          </table>
        </td></tr>

        <!-- Mensaje -->
        <tr><td style="background:#070a13;padding:0 40px 32px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <p style="margin:0 0 10px;font-family:monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5d6883;">Mensaje</p>
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;">
            <p style="margin:0;font-size:15px;color:#97a3bb;line-height:1.7;white-space:pre-wrap;">${data.message}</p>
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#070a13;padding:0 40px 32px;text-align:center;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <a href="mailto:${data.email}?subject=Re: Cotización ${encodeURIComponent(data.type)}"
             style="display:inline-block;background:linear-gradient(180deg,#5aa0ff,#2f80ff);color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
            Responder a ${data.name} →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#05070e;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);border:1px solid rgba(90,160,255,0.12);">
          <p style="margin:0;font-family:monospace;font-size:11px;color:#5d6883;text-align:center;">
            xenith.com.co · Bogotá, Colombia
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('[cotizacion]', err)
    return NextResponse.json({ ok: false, error: 'Error al enviar' }, { status: 500 })
  }
}
