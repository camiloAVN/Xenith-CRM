/**
 * Vencimiento: qué pasa cuando una tarea se pasa de su fecha límite.
 *
 * La regla es una sola y es dura: **pasarse de la fecha cuesta el valor
 * completo de la tarea**. Si la tarea vale 3 y no se entregó a tiempo, se
 * escribe un asiento de −3 en el ledger, automáticamente, sin esperar a que
 * nadie revise nada. El saldo de una persona puede quedar negativo, y con
 * saldo negativo no se lleva nada del reparto (queda en cero, nunca debe).
 *
 * Si después entrega y los jefes la aceptan, se le acredita el valor VIGENTE
 * de la tarea. Por eso la revaluación importa: si el equipo vuelve a votar y
 * la tarea pasa de 3 a 5, al aceptarla suma 5 contra el −3 que ya se cobró.
 *
 * Dos cosas frenan el cobro:
 *   - **Entregar** (`SUBMITTED`): el reloj se detiene al marcar terminada; la
 *     demora de los jefes en revisar no le cuesta puntos a quien ya entregó.
 *   - **Pedir revaluación**: mientras esté pedida, la tarea queda en pausa y no
 *     se cobra nada aunque la fecha pase.
 *
 * Los descuentos por arrastre de sprint y por rechazo se retiraron: el equipo
 * decidió una sola regla, clara y fuerte, en vez de tres porcentajes.
 */

import { dueDeadline, isPastDue } from '@/lib/utils/due-date'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Vista del vencimiento de una tarea, tal como la consumen las 4 vistas. */
export interface TaskPenaltyPreview {
  pointsValue: number | null
  /** Lo que se acredita si se acepta hoy; en una aceptada, lo ya acreditado. */
  effectivePoints: number | null
  /** La fecha ya pasó y la tarea sigue sin entregar (y sin revaluación). */
  isOverdue: boolean
  /** Ya se escribió el asiento negativo: no se vuelve a cobrar. */
  overdueCharged: boolean
  /** Está en revaluación: el reloj está en pausa. */
  inRevaluation: boolean
  /** Horas que faltan para la fecha límite; negativo si ya pasó. */
  hoursLeft: number | null
}

/** Campos mínimos que necesita el preview. */
export interface PenaltyTaskFields {
  dueDate: Date | null
  pointsValue: unknown | null
  effectivePoints: unknown | null
  completionStatus: string
  overdueChargedAt: Date | null
  revaluationRequestedAt: Date | null
}

/**
 * ¿Se le debe cobrar el vencimiento a esta tarea ahora mismo?
 *
 * Exige valor fijado: sin votación cerrada no hay cuánto cobrar, así que el
 * cobro espera a que cierre (el barrido la vuelve a mirar después).
 */
export function shouldChargeOverdue(
  task: PenaltyTaskFields & { valuationStatus?: string; assignedTo?: string | null },
  now: Date = new Date()
): boolean {
  if (task.overdueChargedAt) return false
  if (task.revaluationRequestedAt) return false
  if (task.completionStatus !== 'PENDING') return false
  if (task.assignedTo === null) return false
  if (task.valuationStatus !== undefined && task.valuationStatus !== 'VALUED') return false
  if (task.pointsValue == null) return false
  return isPastDue(task.dueDate, now)
}

export function buildPenaltyPreview(
  task: PenaltyTaskFields,
  _settings?: unknown,
  now: Date = new Date()
): TaskPenaltyPreview {
  const pointsValue = task.pointsValue != null ? Number(task.pointsValue) : null
  const inRevaluation =
    task.revaluationRequestedAt != null && task.completionStatus !== 'ACCEPTED'

  const hoursLeft = task.dueDate
    ? round2((dueDeadline(task.dueDate).getTime() - now.getTime()) / 3_600_000)
    : null

  if (task.completionStatus === 'ACCEPTED') {
    return {
      pointsValue,
      effectivePoints: task.effectivePoints != null ? Number(task.effectivePoints) : null,
      isOverdue: false,
      overdueCharged: task.overdueChargedAt != null,
      inRevaluation: false,
      hoursLeft,
    }
  }

  return {
    pointsValue,
    // Sin descuentos: lo que se acredita al aceptar es el valor vigente.
    effectivePoints: pointsValue,
    isOverdue:
      !inRevaluation &&
      task.completionStatus === 'PENDING' &&
      isPastDue(task.dueDate, now),
    overdueCharged: task.overdueChargedAt != null,
    inRevaluation,
    hoursLeft,
  }
}
