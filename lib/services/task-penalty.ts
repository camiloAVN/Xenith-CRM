import type { ContributionSettings } from '@/lib/services/contribution-settings.service'

/**
 * Descuentos sobre el valor de una tarea.
 *
 * Desde la Fase 2 (Scrum) la referencia es el SPRINT, no la fecha límite: el
 * compromiso del equipo es terminar dentro de la caja de tiempo, así que lo
 * que descuenta es
 *
 *   - **arrastre**: cada vez que la tarea pasa sin terminar a otro sprint;
 *   - **retrabajo**: cada rechazo de los jefes (`completionRound - 1`).
 *
 * La `dueDate` sigue existiendo y se muestra en rojo cuando vence, pero ya no
 * cuesta puntos: penalizar por día era gestión por fechas, no Scrum. Las
 * columnas `lateAccruedDays` / `lateClockStartedAt` quedan en la base para
 * poder leer el histórico; nada nuevo las escribe.
 *
 * El piso (50 % por defecto) sigue siendo el mismo: por muchos tropiezos que
 * tenga, una tarea nunca vale menos de la mitad de lo que el equipo estimó.
 */

export interface TaskDiscountInput {
  /** Rechazos de los jefes: `completionRound - 1`. */
  rejections: number
  /** Veces que la tarea se arrastró a otro sprint. */
  carryovers: number
}

export interface DiscountResult {
  /** Puntos descontados por retrabajo, antes del piso. */
  reworkPenalty: number
  /** Puntos descontados por arrastre, antes del piso. */
  carryoverPenalty: number
  /** Descuento total ya topado por el piso. */
  penalty: number
  /** Valor acreditable: valor estimado − descuento. */
  effectivePoints: number
  /** true si el piso recortó el descuento. */
  floored: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Descuento sobre un valor ya fijado.
 *
 * Los dos descuentos son proporcionales al valor de la tarea: 25 % de un 13
 * pesa más que 25 % de un 2, que es justamente lo que se quiere —perder el
 * sprint en algo grande cuesta más—. Se suman (no se componen) y el piso los
 * recorta al final.
 */
export function computeDiscounts(
  pointsValue: number,
  input: TaskDiscountInput,
  settings: ContributionSettings
): DiscountResult {
  const rejections = Math.max(0, Math.floor(input.rejections))
  const carryovers = Math.max(0, Math.floor(input.carryovers))

  const reworkPenalty = pointsValue * settings.reworkPenalty * rejections
  const carryoverPenalty = pointsValue * settings.carryoverPenalty * carryovers

  const raw = reworkPenalty + carryoverPenalty
  const maxPenalty = pointsValue - pointsValue * settings.penaltyFloorRatio
  const penalty = Math.min(raw, maxPenalty)

  return {
    reworkPenalty: round2(reworkPenalty),
    carryoverPenalty: round2(carryoverPenalty),
    // Redondeo a 2 decimales: la columna es Decimal(5,2) y evita arrastrar
    // ruido de coma flotante al ledger, que se suma para el %.
    penalty: round2(penalty),
    effectivePoints: round2(pointsValue - penalty),
    floored: raw > maxPenalty,
  }
}

/** Vista en vivo de los descuentos de una tarea, tal como la consume la UI. */
export interface TaskPenaltyPreview {
  pointsValue: number | null
  /** Valor acreditable hoy; en una tarea aceptada, el que ya se acreditó. */
  effectivePoints: number | null
  penalty: number
  reworkPenalty: number
  carryoverPenalty: number
  rejections: number
  carryovers: number
  floored: boolean
  /** Informativo: la fecha límite ya pasó. No descuenta nada. */
  isOverdue: boolean
}

/** Campos mínimos que necesita el preview. */
export interface PenaltyTaskFields {
  dueDate: Date | null
  pointsValue: unknown | null
  effectivePoints: unknown | null
  completionStatus: string
  completionRound: number
  carriedOverCount: number
}

/**
 * Descuentos vigentes de una tarea.
 *
 * En una tarea ACEPTADA no se recalcula nada: el valor efectivo quedó
 * congelado al aceptarla y es el que está en el ledger. Recalcularlo la haría
 * "seguir cambiando" después de cobrada.
 */
export function buildPenaltyPreview(
  task: PenaltyTaskFields,
  settings: ContributionSettings,
  now: Date = new Date()
): TaskPenaltyPreview {
  const pointsValue = task.pointsValue != null ? Number(task.pointsValue) : null
  const rejections = Math.max(0, (task.completionRound ?? 1) - 1)
  const carryovers = task.carriedOverCount ?? 0
  const isOverdue = task.dueDate != null && task.dueDate < now && task.completionStatus !== 'ACCEPTED'

  if (task.completionStatus === 'ACCEPTED') {
    const effectivePoints = task.effectivePoints != null ? Number(task.effectivePoints) : null
    return {
      pointsValue,
      effectivePoints,
      penalty:
        pointsValue != null && effectivePoints != null
          ? round2(pointsValue - effectivePoints)
          : 0,
      reworkPenalty: 0,
      carryoverPenalty: 0,
      rejections,
      carryovers,
      floored: false,
      isOverdue: false,
    }
  }

  // Sin valor fijado todavía no hay nada que descontar, pero los tropiezos ya
  // se cuentan: el equipo debe verlos antes de que cierre la votación.
  if (pointsValue == null) {
    return {
      pointsValue: null,
      effectivePoints: null,
      penalty: 0,
      reworkPenalty: 0,
      carryoverPenalty: 0,
      rejections,
      carryovers,
      floored: false,
      isOverdue,
    }
  }

  const result = computeDiscounts(pointsValue, { rejections, carryovers }, settings)
  return {
    pointsValue,
    effectivePoints: result.effectivePoints,
    penalty: result.penalty,
    reworkPenalty: result.reworkPenalty,
    carryoverPenalty: result.carryoverPenalty,
    rejections,
    carryovers,
    floored: result.floored,
    isOverdue,
  }
}
