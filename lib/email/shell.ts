/**
 * Piezas compartidas de los correos: shell HTML, pie, escape y filas de tabla.
 *
 * Vive aparte de `templates.ts` porque ahora hay dos familias de correos
 * (formulario publico y sistema de puntos) y ninguna deberia depender de la
 * otra solo para reusar el marco.
 */

/** URL del dashboard: los enlaces de los correos internos apuntan ahi. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://xenith.com.co'

/**
 * URL pública canónica. Se usa para el logo y los enlaces de los correos,
 * por eso NO puede ser localhost en producción.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://xenith.com.co'

export const LOGO_URL = `${SITE_URL}/images/logo.png`

/** Escapa datos del usuario antes de interpolarlos en el HTML del correo. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Fila de la tabla de datos. Devuelve '' si no hay valor. */
export function row(label: string, valueHtml: string | undefined): string {
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

export const shellStart = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">`

export const shellEnd = `
      </table>
    </td></tr>
  </table>
</body>
</html>`

/** Pie de página con el dominio de Xenith. */
export const footer = `
        <tr><td style="background:#05070e;border-radius:0 0 16px 16px;padding:22px 40px;border:1px solid rgba(90,160,255,0.12);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <a href="${SITE_URL}" style="display:inline-block;font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#5aa0ff;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
          <p style="margin:8px 0 0;font-family:monospace;font-size:11px;color:#5d6883;">Bogotá, Colombia</p>
        </td></tr>`

