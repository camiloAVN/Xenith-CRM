'use client'

import { TimerOff, Timer, TrendingDown } from 'lucide-react'

export interface TaskPenaltyData {
  lateDays: number
  fullDaysLate: number
  penalty: number
  pointsValue: number | null
  effectivePoints: number | null
  floored: boolean
  clockRunning: boolean
  isOverdue: boolean
}

interface TaskPenaltyProps {
  penalty?: TaskPenaltyData | null
  /** Una tarea ya aceptada muestra el descuento congelado, no uno en curso. */
  isAccepted?: boolean
}

/**
 * Penalización por retraso.
 *
 * Solo aparece cuando hay retraso real: una tarea al día no gana una franja
 * que no dice nada.
 */
export function TaskPenalty({ penalty, isAccepted = false }: TaskPenaltyProps) {
  if (!penalty || !penalty.isOverdue) return null

  const { fullDaysLate, penalty: discount, pointsValue, effectivePoints, floored, clockRunning } =
    penalty

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-red-300">
          <TrendingDown className="w-3.5 h-3.5" />
          {fullDaysLate} día{fullDaysLate === 1 ? '' : 's'} de retraso
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          {clockRunning ? (
            <>
              <Timer className="w-3 h-3 text-amber-400" />
              contando
            </>
          ) : (
            <>
              <TimerOff className="w-3 h-3" />
              {isAccepted ? 'cerrado' : 'pausado'}
            </>
          )}
        </span>
      </div>

      {pointsValue == null ? (
        <p className="text-xs text-gray-400">
          El descuento se calcula cuando cierre la votación y haya un valor.
        </p>
      ) : (
        <p className="text-xs text-gray-300 tabular-nums">
          {pointsValue} − {discount} ={' '}
          <span className="font-semibold text-gray-100">{effectivePoints}</span> puntos
          {isAccepted ? ' acreditados' : ' si se acepta hoy'}
        </p>
      )}

      {floored && (
        <p className="text-[11px] text-amber-400 leading-relaxed">
          La penalización tocó el piso: una tarea nunca baja del 50 % de su valor.
        </p>
      )}

      {!clockRunning && !isAccepted && (
        <p className="text-[11px] text-gray-500 leading-relaxed">
          El contador está pausado desde que la marcaste como terminada. La
          demora de los jefes en revisar no te cuesta puntos.
        </p>
      )}
    </div>
  )
}
