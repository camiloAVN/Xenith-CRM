import { APP_URL, esc, shellStart, shellEnd, footer } from './shell'

/**
 * Correos del sistema de puntos de aporte.
 *
 * Todos comparten el mismo marco visual que los del formulario público y
 * llevan un enlace directo al proyecto: el objetivo del correo es que la
 * persona entre y actúe (votar, revisar), no que lea un informe.
 */

export interface TaskEmailContext {
  projectId: string
  projectTitle: string
  taskTitle: string
  /** Nombre visible de quien tiene la tarea. */
  assigneeName: string
  dueDate?: Date | null
}

const dateFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function header(eyebrow: string, title: string): string {
  return `
        <tr><td style="background:#05070e;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <p style="margin:0 0 10px;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5aa0ff;">
            ${esc(eyebrow)}
          </p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
            ${esc(title)}
          </h1>
        </td></tr>`
}

function body(inner: string): string {
  return `
        <tr><td style="background:#070a13;padding:24px 40px;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          ${inner}
        </td></tr>`
}

function taskCard(ctx: TaskEmailContext, extra?: string): string {
  return `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;">
            <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#5d6883;">${esc(ctx.projectTitle)}</p>
            <p style="margin:0;font-size:17px;font-weight:600;color:#ffffff;line-height:1.4;">${esc(ctx.taskTitle)}</p>
            <p style="margin:10px 0 0;font-size:13px;color:#97a3bb;">
              Asignada a <strong style="color:#eef2fb;">${esc(ctx.assigneeName)}</strong>${
                ctx.dueDate
                  ? ` · vence el ${esc(dateFmt.format(new Date(ctx.dueDate)))}`
                  : ''
              }
            </p>
            ${extra ?? ''}
          </div>`
}

function cta(projectId: string, label: string): string {
  return `
        <tr><td style="background:#070a13;padding:0 40px 32px;text-align:center;border-left:1px solid rgba(90,160,255,0.15);border-right:1px solid rgba(90,160,255,0.15);">
          <a href="${APP_URL}/dashboard/proyectos/${encodeURIComponent(projectId)}"
             style="display:inline-block;background:linear-gradient(180deg,#5aa0ff,#2f80ff);color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">
            ${esc(label)} →
          </a>
        </td></tr>`
}

function note(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:#97a3bb;line-height:1.7;">${esc(text)}</p>`
}

/* ── 1. Tarea creada — votación de puntos abierta ─────────────────────── */

export function votingOpenedEmail(
  ctx: TaskEmailContext & { closesAt: Date; minPoints: number; maxPoints: number }
): string {
  const closes = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ctx.closesAt))

  return `${shellStart}
${header('Xenith · Puntos de aporte', 'Hay una tarea por valorar')}
${body(
  taskCard(ctx) +
    note(
      `Vota cuántos puntos vale esta tarea, entre ${ctx.minPoints} y ${ctx.maxPoints}. La votación cierra el ${closes}. Si no se alcanza el mínimo de votos, la tarea queda en ${ctx.minPoints} puntos.`
    )
)}
${cta(ctx.projectId, 'Votar ahora')}
${footer}${shellEnd}`
}

/* ── 2. Votación cerrada — puntos finalizados ─────────────────────────── */

export function valuationSettledEmail(
  ctx: TaskEmailContext & {
    pointsValue: number
    voteCount: number
    reachedQuorum: boolean
    needsDiscussion: boolean
  }
): string {
  const detail = ctx.reachedQuorum
    ? `Mediana de ${ctx.voteCount} voto${ctx.voteCount === 1 ? '' : 's'}.`
    : 'No se alcanzó el mínimo de votos, así que la tarea tomó el valor mínimo del rango.'

  const warning = ctx.needsDiscussion
    ? `
            <p style="margin:14px 0 0;padding:12px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:10px;font-size:13px;color:#fcd34d;line-height:1.6;">
              Los votos quedaron muy dispersos: vale la pena que el equipo hable de esta tarea. El valor de la mediana ya quedó aplicado.
            </p>`
    : ''

  return `${shellStart}
${header('Xenith · Puntos de aporte', `Valorada en ${ctx.pointsValue} puntos`)}
${body(
  taskCard(
    ctx,
    `
            <p style="margin:14px 0 0;font-size:28px;font-weight:700;color:#5aa0ff;line-height:1;">${ctx.pointsValue}<span style="font-size:14px;font-weight:400;color:#5d6883;"> puntos</span></p>` +
      warning
  ) + note(detail)
)}
${cta(ctx.projectId, 'Ver el proyecto')}
${footer}${shellEnd}`
}

/* ── 3. El asignado marcó la tarea como terminada ─────────────────────── */

export function completionSubmittedEmail(ctx: TaskEmailContext): string {
  return `${shellStart}
${header('Xenith · Puntos de aporte', 'Una tarea espera tu aprobación')}
${body(
  taskCard(ctx) +
    note(
      `${ctx.assigneeName} marcó esta tarea como terminada. Los puntos se acreditan cuando todos los jefes del proyecto la acepten. El contador de retraso ya está pausado, así que revisarla con calma no le cuesta puntos a nadie.`
    )
)}
${cta(ctx.projectId, 'Revisar la tarea')}
${footer}${shellEnd}`
}

/* ── 4. Cumplimiento aceptado — puntos acreditados ────────────────────── */

export function completionAcceptedEmail(
  ctx: TaskEmailContext & {
    pointsValue: number
    effectivePoints: number
    penalty: number
    daysLate: number
  }
): string {
  const penaltyLine =
    ctx.penalty > 0
      ? `
            <p style="margin:10px 0 0;font-size:13px;color:#fca5a5;">
              Valor ${ctx.pointsValue} menos ${ctx.penalty} por ${ctx.daysLate} día${ctx.daysLate === 1 ? '' : 's'} de retraso.
            </p>`
      : ''

  return `${shellStart}
${header('Xenith · Puntos de aporte', 'Tu cumplimiento fue aceptado')}
${body(
  taskCard(
    ctx,
    `
            <p style="margin:14px 0 0;font-size:28px;font-weight:700;color:#34d399;line-height:1;">+${ctx.effectivePoints}<span style="font-size:14px;font-weight:400;color:#5d6883;"> puntos</span></p>` +
      penaltyLine
  ) + note('Estos puntos ya cuentan en tu porcentaje de aporte al proyecto.')
)}
${cta(ctx.projectId, 'Ver mi aporte')}
${footer}${shellEnd}`
}

/* ── 5. Cumplimiento rechazado — vuelve a en progreso ─────────────────── */

export function completionRejectedEmail(
  ctx: TaskEmailContext & { reviewerName: string; comment?: string | null }
): string {
  const commentBlock = ctx.comment
    ? `
            <div style="margin:14px 0 0;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
              <p style="margin:0;font-size:13px;color:#97a3bb;line-height:1.6;white-space:pre-wrap;">${esc(ctx.comment)}</p>
            </div>`
    : ''

  return `${shellStart}
${header('Xenith · Puntos de aporte', 'Tu tarea volvió a en progreso')}
${body(
  taskCard(ctx, commentBlock) +
    note(
      `${ctx.reviewerName} no aceptó el cumplimiento. El contador de retraso volvió a correr desde el rechazo: vuelve a marcarla como terminada cuando esté lista.`
    )
)}
${cta(ctx.projectId, 'Ver la tarea')}
${footer}${shellEnd}`
}
