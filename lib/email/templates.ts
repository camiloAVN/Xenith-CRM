import type { CotizacionFormData } from '@/lib/validations/cotizacion'

/**
 * URL pública canónica. Se usa para el logo y los enlaces de los correos,
 * por eso NO puede ser localhost en producción.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://xenith.com.co'

const LOGO_URL = `${SITE_URL}/images/logo.png`

/** Escapa datos del usuario antes de interpolarlos en el HTML del correo. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Fila de la tabla de datos. Devuelve '' si no hay valor. */
function row(label: string, valueHtml: string | undefined): string {
  if (!valueHtml) return ''
  return `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
      <td style="padding:14px 18px;background:rgba(255,255,255,0.03);width:120px;vertical-align:top;">
        <p style="margin:0;font-family:monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5d6883;">${label}</p>
      </td>
      <td style="padding:14px 18px;background:rgba(255,255,255,0.01);">
        <p style="margin:0;font-size:15px;color:#eef2fb;">${valueHtml}</p>
      </td>
    </tr>`
}

const shellStart = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">`

const shellEnd = `
      </table>
    </td></tr>
  </table>
</body>
</html>`

/** Pie de página con el dominio de Xenith. */
const footer = `
        <tr><td style="background:#05070e;border-radius:0 0 16px 16px;padding:22px 40px;border:1px solid rgba(90,160,255,0.12);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <a href="${SITE_URL}" style="display:inline-block;font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#5aa0ff;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
          <p style="margin:8px 0 0;font-family:monospace;font-size:11px;color:#5d6883;">Bogotá, Colombia</p>
        </td></tr>`

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
