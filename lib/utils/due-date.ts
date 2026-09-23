/**
 * Fecha límite de una tarea.
 *
 * La tarea guarda un DÍA de calendario (el `<input type="date">` manda
 * "2026-09-23"), y vence a las **12:00 de la medianoche hora de Bogotá** al
 * terminar ese día: una tarea para hoy se puede entregar hasta las 11:59 pm.
 *
 * El bug que esto corrige: `new Date('2026-09-23')` es medianoche UTC, que en
 * Bogotá es el 22 a las 7 pm. La tarea salía vencida un día antes y además se
 * mostraba con el día anterior.
 *
 * Regla: el día de la tarea es la fecha UTC de lo guardado. Lo guardado es un
 * ANCLA al mediodía de Bogotá (17:00Z), no el vencimiento: si se guardara la
 * medianoche (05:00Z del día siguiente) la fecha UTC ya sería el otro día.
 * Así sirven igual las filas viejas (00:00Z) y las nuevas (17:00Z).
 */

/** Bogotá es UTC−5 todo el año (sin horario de verano). */
const ANCHOR_HOUR_UTC = 17 // mediodía de Bogotá: ancla del día, para guardar y mostrar
const DEADLINE_HOUR_UTC = 5 // medianoche de Bogotá = 05:00Z del día siguiente
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Día de calendario de la tarea, "YYYY-MM-DD" (sirve para `<input type="date">`). */
export function dueDateKey(value: string | Date): string {
  if (typeof value === 'string' && DAY_RE.test(value)) return value
  return new Date(value).toISOString().slice(0, 10)
}

/** Ese día al mediodía de Bogotá: lo que se guarda y lo que se pinta. */
export function dueDayAnchor(value: string | Date): Date {
  const [y, m, d] = dueDateKey(value).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, ANCHOR_HOUR_UTC))
}

/** Instante exacto en que vence: la medianoche de Bogotá al terminar ese día. */
export function dueDeadline(value: string | Date): Date {
  const [y, m, d] = dueDateKey(value).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1, DEADLINE_HOUR_UTC))
}

/** Convierte lo que llega del formulario en lo que se guarda. */
export function parseDueDate(value: string): Date {
  return dueDayAnchor(value)
}

export function isPastDue(value: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!value) return false
  return dueDeadline(value) <= now
}

/** Formatea el día de la tarea sin que la zona horaria del navegador lo corra. */
export function formatDueDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
  locale = 'es-CO'
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'America/Bogota' }).format(
    dueDayAnchor(value)
  )
}

/** Límites de un filtro por rango de días (incluye el día completo). */
export function dueDayStart(value: string): Date {
  return new Date(`${dueDateKey(value)}T00:00:00.000Z`)
}
export function dueDayEnd(value: string): Date {
  return new Date(`${dueDateKey(value)}T23:59:59.999Z`)
}
