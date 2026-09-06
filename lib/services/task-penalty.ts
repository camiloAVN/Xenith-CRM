import type { ContributionSettings } from '@/lib/services/contribution-settings.service'

/**
 * Penalización por retraso.
 *
 * El reloj corre solo DESPUÉS de la fecha límite y se pausa cuando el asignado
 * marca "terminada" — no cuando los jefes aceptan — para no castigarlo por la
 * demora de la revisión. Si los jefes rechazan, vuelve a correr desde el
 * rechazo hasta que se re-marque terminada.
 *
 * Eso da una serie de tramos abiertos y cerrados. En vez de reconstruirlos
 * desde el historial, la tarea guarda `lateAccruedDays` (suma de los tramos ya
 * cerrados) y `lateClockStartedAt` (inicio del tramo abierto, o null si está
 * pausado). El total es la suma de ambos.
 */

const MS_PER_DAY = 86_400_000

export interface PenaltyInput {
  dueDate: Date | null
  /** Días de los tramos ya cerrados. */
  lateAccruedDays: number
  /** Inicio del tramo en curso; null = reloj pausado. */
  lateClockStartedAt: Date | null
  now?: Date
}

/**
 * Días de retraso que aporta un tramo [start, end].
 *
 * Se recorta contra `dueDate`: un tramo que termina antes de la fecha límite
 * aporta cero, y uno que la cruza aporta solo su parte posterior.
 */
export function intervalLateDays(
  start: Date,
  end: Date,
  dueDate: Date | null
): number {
  if (!dueDate) return 0
  const from = Math.max(start.getTime(), dueDate.getTime())
  const elapsed = end.getTime() - from
  return elapsed > 0 ? elapsed / MS_PER_DAY : 0
}

/** Retraso total acumulado, incluyendo el tramo abierto si el reloj corre. */
export function totalLateDays(input: PenaltyInput): number {
  const now = input.now ?? new Date()
  const open = input.lateClockStartedAt
    ? intervalLateDays(input.lateClockStartedAt, now, input.dueDate)
    : 0
  return input.lateAccruedDays + open
}

export interface PenaltyResult {
  /** Días completos vencidos: 1.9 días de retraso penalizan como 1. */
  fullDaysLate: number
  /** Puntos descontados, ya topados por el piso. */
  penalty: number
  /** Valor acreditable: valor finalizado − penalización. */
  effectivePoints: number
  /** true si el piso recortó la penalización. */
  floored: boolean
}

/**
 * Penalización sobre un valor ya fijado.
 *
 * Se cuentan días COMPLETOS vencidos (`floor`), y el piso impide que la tarea
 * baje del porcentaje configurado de su valor (50 % por defecto).
 */
export function computePenalty(
  pointsValue: number,
  lateDays: number,
  settings: ContributionSettings
): PenaltyResult {
  const fullDaysLate = Math.max(0, Math.floor(lateDays))
  const rawPenalty = fullDaysLate * settings.penaltyPerDay
  const floorValue = pointsValue * settings.penaltyFloorRatio
  const maxPenalty = pointsValue - floorValue

  const penalty = Math.min(rawPenalty, maxPenalty)
  // Redondeo a 2 decimales: la columna es Decimal(5,2) y evita arrastrar
  // ruido de coma flotante (0.1 + 0.2) al ledger, que se suma para el %.
  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    fullDaysLate,
    penalty: round2(penalty),
    effectivePoints: round2(pointsValue - penalty),
    floored: rawPenalty > maxPenalty,
  }
}

/** Vista en vivo de la penalización de una tarea, tal como la consume la UI. */
export interface TaskPenaltyPreview {
  /** Días de retraso fraccionarios acumulados hasta ahora. */
  lateDays: number
  /** Días completos que sí penalizan. */
  fullDaysLate: number
  penalty: number
  pointsValue: number | null
  /** Valor acreditable hoy; en una tarea aceptada, el que ya se acreditó. */
  effectivePoints: number | null
  floored: boolean
  /** true si el reloj está corriendo ahora mismo. */
  clockRunning: boolean
  isOverdue: boolean
}

/** Campos mínimos que necesita el preview. */
export interface PenaltyTaskFields {
  dueDate: Date | null
  pointsValue: unknown | null
  effectivePoints: unknown | null
  completionStatus: string
  lateAccruedDays: unknown
  lateClockStartedAt: Date | null
}

/**
 * Penalización vigente de una tarea.
 *
 * En una tarea ACEPTADA no se recalcula nada: el valor efectivo quedó
 * congelado en el momento de la aceptación y es el que está en el ledger.
 * Recalcularlo la haría "seguir penalizándose" después de cobrada.
 */
export function buildPenaltyPreview(
  task: PenaltyTaskFields,
  settings: ContributionSettings,
  now: Date = new Date()
): TaskPenaltyPreview {
  const pointsValue = task.pointsValue != null ? Number(task.pointsValue) : null

  if (task.completionStatus === 'ACCEPTED') {
    const lateDays = Number(task.lateAccruedDays)
    return {
      lateDays,
      fullDaysLate: Math.max(0, Math.floor(lateDays)),
      penalty:
        pointsValue != null && task.effectivePoints != null
          ? Math.round((pointsValue - Number(task.effectivePoints)) * 100) / 100
          : 0,
      pointsValue,
      effectivePoints: task.effectivePoints != null ? Number(task.effectivePoints) : null,
      floored: false,
      clockRunning: false,
      isOverdue: lateDays > 0,
    }
  }

  const lateDays = totalLateDays({
    dueDate: task.dueDate,
    lateAccruedDays: Number(task.lateAccruedDays),
    lateClockStartedAt: task.lateClockStartedAt,
    now,
  })

  // Sin valor fijado todavía no hay nada que descontar, pero el retraso ya
  // se muestra: el equipo debe verlo correr antes de que cierre la votación.
  if (pointsValue == null) {
    return {
      lateDays,
      fullDaysLate: Math.max(0, Math.floor(lateDays)),
      penalty: 0,
      pointsValue: null,
      effectivePoints: null,
      floored: false,
      clockRunning: task.lateClockStartedAt != null,
      isOverdue: lateDays > 0,
    }
  }

  const result = computePenalty(pointsValue, lateDays, settings)
  return {
    lateDays,
    fullDaysLate: result.fullDaysLate,
    penalty: result.penalty,
    pointsValue,
    effectivePoints: result.effectivePoints,
    floored: result.floored,
    clockRunning: task.lateClockStartedAt != null,
    isOverdue: lateDays > 0,
  }
}
