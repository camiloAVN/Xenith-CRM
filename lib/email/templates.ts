import type { CotizacionFormData } from '@/lib/validations/cotizacion'
import { SITE_URL, LOGO_URL, esc, row, shellStart, shellEnd, footer } from './shell'

export { SITE_URL }

/* ────────────────────────────────────────────────────────────
   1. Correo interno — aviso a Xenith de una nueva solicitud
   ──────────────────────────────────────────────────────────── */
export function internalNotificationEmail(data: CotizacionFormData): string {
  const name = esc(data.name)
  const email = esc(data.email)

  return `${shellStart}

        <!-- Header -->
        <tr><td style="background:#05070e;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0 0 10px;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5aa0ff;">
            XENITH · ENGINEERING STUDIO
          </p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
            Nueva solicitud de cotización
          </h1>
        </td></tr>

        <!-- Datos del contacto -->
        <tr><td style="background:#070a13;padding:24px 40px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;">
            ${row('Nombre', `<strong style="color:#ffffff;font-weight:600;">${name}</strong>`)}
            ${row('Email', `<a href="mailto:${email}" style="color:#5aa0ff;text-decoration:none;">${email}</a>`)}
            ${data.phone ? row('Teléfono', `<a href="tel:${esc(data.phone)}" style="color:#5aa0ff;text-decoration:none;">${esc(data.phone)}</a>`) : ''}
            ${data.company ? row('Empresa', esc(data.company)) : ''}
          </table>
        </td></tr>

        ${
          data.message
            ? `<!-- Mensaje -->
        <tr><td style="background:#070a13;padding:0 40px 24px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <p style="margin:0 0 10px;font-family:monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5d6883;">Mensaje</p>
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;">
            <p style="margin:0;font-size:15px;color:#97a3bb;line-height:1.7;white-space:pre-wrap;">${esc(data.message)}</p>
          </div>
        </td></tr>`
            : ''
        }

        <!-- CTA -->
        <tr><td style="background:#070a13;padding:0 40px 32px;text-align:center;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <a href="mailto:${email}?subject=Re:%20Tu%20solicitud%20en%20Xenith"
             style="display:inline-block;background:linear-gradient(180deg,#5aa0ff,#2f80ff);color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">
            Responder a ${name} →
          </a>
        </td></tr>
${footer}${shellEnd}`
}

/* ────────────────────────────────────────────────────────────
   2. Correo de agradecimiento — se envía a quien llenó el form
   ──────────────────────────────────────────────────────────── */
export function thankYouEmail(data: CotizacionFormData): string {
  const firstName = esc(data.name.trim().split(/\s+/)[0])

  return `${shellStart}

        <!-- Header con logo -->
        <tr><td style="background:#05070e;border-radius:16px 16px 0 0;padding:36px 40px 30px;text-align:center;">
          <img src="${LOGO_URL}" alt="Xenith" width="180"
               style="display:block;margin:0 auto 22px;width:180px;max-width:60%;height:auto;border:0;color:#eef2fb;font-size:20px;font-weight:700;" />
          <p style="margin:0 0 10px;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5aa0ff;">
            Solicitud recibida
          </p>
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
            Gracias por tu interés, ${firstName}
          </h1>
        </td></tr>

        <!-- Cuerpo -->
        <tr><td style="background:#070a13;padding:32px 40px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#c3cbdb;">
            Recibimos tu solicitud y ya está en manos de nuestro equipo.
          </p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#97a3bb;">
            Vamos a revisar con detalle lo que nos contaste y <strong style="color:#eef2fb;font-weight:600;">te daremos respuesta muy pronto</strong> a este mismo correo. Si tu proyecto es urgente, puedes responder directamente a este mensaje y lo priorizamos.
          </p>
          <p style="margin:0;font-size:16px;line-height:1.75;color:#97a3bb;">
            Gracias por pensar en Xenith.
          </p>
        </td></tr>

        ${
          data.message
            ? `<!-- Resumen de lo enviado -->
        <tr><td style="background:#070a13;padding:0 40px 32px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <p style="margin:0 0 10px;font-family:monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5d6883;">Esto fue lo que nos enviaste</p>
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;">
            <p style="margin:0;font-size:15px;color:#97a3bb;line-height:1.7;white-space:pre-wrap;">${esc(data.message)}</p>
          </div>
        </td></tr>`
            : ''
        }

        <!-- CTA al sitio -->
        <tr><td style="background:#070a13;padding:0 40px 34px;text-align:center;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <a href="${SITE_URL}"
             style="display:inline-block;background:linear-gradient(180deg,#5aa0ff,#2f80ff);color:#ffffff;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;text-decoration:none;">
            Conocer más sobre Xenith →
          </a>
        </td></tr>
${footer}${shellEnd}`
}
