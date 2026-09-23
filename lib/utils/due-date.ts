/**
 * Fecha límite de una tarea.
 *
 * La tarea guarda un DÍA de calendario (el `<input type="date">` manda
 * "2026-09-23"), y vence a las **12:00 del mediodía hora de Bogotá** de ese día.
 *
 * El bug que esto corrige: `new Date('2026-09-23')` es medianoche UTC, que en
 * Bogotá es el 22 a las 7 pm. La tarea salía vencida un día antes y además se
 * mostraba con el día anterior.
 *
 * Regla: el día de la tarea es la fecha UTC de lo guardado. Así sirven igual
 * las filas viejas (00:00Z) y las nuevas (17:00Z) sin tocar la base.
 */

/** Bogotá es UTC−5 todo el año (sin horario de verano): mediodía = 17:00Z. */
const DUE_HOUR_UTC = 17
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Día de calendario de la tarea, "YYYY-MM-DD" (sirve para `<input type="date">`). */
export function dueDateKey(value: string | Date): string {
  if (typeof value === 'string' && DAY_RE.test(value)) return value
  return new Date(value).toISOString().slice(0, 10)
}

/** Instante exacto en que vence: ese día a las 12:00 de Bogotá. */
export function dueDeadline(value: string | Date): Date {
  const [y, m, d] = dueDateKey(value).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, DUE_HOUR_UTC))
}

/** Convierte lo que llega del formulario en lo que se guarda. */
export function parseDueDate(value: string): Date {
  return dueDeadline(value)
}

export function isPastDue(value: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!value) return false
  return dueDeadline(value) < now
}

/** Formatea el día de la tarea sin que la zona horaria del navegador lo corra. */
export function formatDueDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
  locale = 'es-CO'
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'America/Bogota' }).format(
    dueDeadline(value)
  )
}

/** Límites de un filtro por rango de días (incluye el día completo). */
export function dueDayStart(value: string): Date {
  return new Date(`${dueDateKey(value)}T00:00:00.000Z`)
}
export function dueDayEnd(value: string): Date {
  return new Date(`${dueDateKey(value)}T23:59:59.999Z`)
}
