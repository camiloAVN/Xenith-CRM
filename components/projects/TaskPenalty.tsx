'use client'

import { TrendingDown, RotateCcw, ArrowRightLeft } from 'lucide-react'

export interface TaskPenaltyData {
  pointsValue: number | null
  effectivePoints: number | null
  penalty: number
  reworkPenalty: number
  carryoverPenalty: number
  rejections: number
  carryovers: number
  floored: boolean
  isOverdue: boolean
}

interface TaskPenaltyProps {
  penalty?: TaskPenaltyData | null
  /** Una tarea ya aceptada muestra el descuento congelado, no uno en curso. */
  isAccepted?: boolean
}

/**
 * Descuentos sobre el valor de la tarea.
 *
 * Solo aparece cuando hay algo que descontar: una tarea que va limpia no gana
 * una franja que no dice nada. Lo que descuenta son los tropiezos del proceso
 * —rechazos y arrastres de sprint—, no la fecha límite.
 */
export function TaskPenalty({ penalty, isAccepted = false }: TaskPenaltyProps) {
  if (!penalty) return null

  const { rejections, carryovers, penalty: discount, pointsValue, effectivePoints, floored } =
    penalty

  const hasDiscount = rejections > 0 || carryovers > 0
  if (!hasDiscount) return null

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-medium text-red-300">
          <TrendingDown className="w-3.5 h-3.5" />
          Descuentos
        </span>
        {rejections > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <RotateCcw className="w-3 h-3" />
            {rejections} rechazo{rejections === 1 ? '' : 's'}
          </span>
        )}
        {carryovers > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <ArrowRightLeft className="w-3 h-3" />
            {carryovers} arrastre{carryovers === 1 ? '' : 's'} de sprint
          </span>
        )}
      </div>

      {pointsValue == null ? (
        <p className="text-xs text-gray-400">
          El descuento se calcula cuando cierre la votación y haya un valor.
        </p>
      ) : (
        <p className="text-xs text-gray-300 tabular-nums">
          {pointsValue} − {discount} ={' '}
          <span className="font-semibold text-gray-100">{effectivePoints}</span> puntos
          {isAccepted ? ' acreditados' : ' si se acepta así'}
        </p>
      )}

      {floored && (
        <p className="text-[11px] text-amber-400 leading-relaxed">
          El descuento tocó el piso: una tarea nunca baja del 50 % de lo que el
          equipo estimó.
        </p>
      )}
    </div>
  )
}
