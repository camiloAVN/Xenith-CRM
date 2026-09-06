'use client'

import { AlertTriangle, TrendingDown, Vote } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface TaskPointsData {
  valuationStatus?: 'VOTING' | 'EXTENDED' | 'VALUED' | null
  completionStatus?: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | null
  pointsValue?: string | number | null
  needsDiscussion?: boolean | null
  penalty?: {
    penalty: number
    effectivePoints: number | null
    isOverdue: boolean
  } | null
}

interface TaskPointsBadgeProps {
  task: TaskPointsData
  /** `sm` para las tarjetas del Kanban, `md` para lista y Gantt. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Valor en puntos de una tarea, en una sola pieza compartida por el Kanban,
 * la lista y el Gantt — así las tres vistas no pueden mostrar cosas distintas.
 *
 * Estados:
 *   · votación abierta        -> "votando"
 *   · valorada, sin retraso   -> "6 pts"
 *   · valorada, con retraso   -> "5.4" tachando el "6" original
 *   · aceptada                -> igual, pero en verde (ya está en el ledger)
 *
 * Las tareas anteriores al sistema de puntos no tienen valor y no dibujan nada.
 */
export function TaskPointsBadge({ task, size = 'sm', className }: TaskPointsBadgeProps) {
  const isVoting = task.valuationStatus && task.valuationStatus !== 'VALUED'
  const raw = task.pointsValue != null ? Number(task.pointsValue) : null

  if (!isVoting && raw == null) return null

  const text = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const pad = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'

  if (isVoting) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded border font-medium',
          'bg-blue-500/10 text-blue-300 border-blue-500/25',
          text,
          pad,
          className
        )}
        title="Votación de puntos abierta"
      >
        <Vote className="w-3 h-3" />
        votando
      </span>
    )
  }

  const accepted = task.completionStatus === 'ACCEPTED'
  const effective = task.penalty?.effectivePoints ?? raw
  const penalized = (task.penalty?.penalty ?? 0) > 0 && effective !== raw

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded border font-semibold tabular-nums',
          accepted
            ? 'bg-green-500/10 text-green-300 border-green-500/25'
            : 'bg-violet-500/10 text-violet-300 border-violet-500/25',
          text,
          pad
        )}
        title={
          accepted
            ? `${effective} puntos acreditados`
            : penalized
              ? `Valor ${raw}, ${effective} tras la penalización por retraso`
              : `${raw} puntos`
        }
      >
        {penalized && (
          <span className="text-gray-500 line-through font-normal">{raw}</span>
        )}
        {effective}
        <span className="font-normal opacity-60">pts</span>
      </span>

      {penalized && (
        <TrendingDown className="w-3 h-3 text-red-400" aria-label="Penalizada por retraso" />
      )}

      {task.needsDiscussion && (
        <AlertTriangle
          className="w-3 h-3 text-amber-400"
          aria-label="Los votos quedaron dispersos: necesita discusión"
        />
      )}
    </span>
  )
}
