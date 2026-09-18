'use client'

import { useState } from 'react'
import { AlertTriangle, PauseCircle, TimerOff, RefreshCw, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

export interface TaskPenaltyData {
  pointsValue: number | null
  effectivePoints: number | null
  isOverdue: boolean
  overdueCharged: boolean
  inRevaluation: boolean
  hoursLeft: number | null
}

interface TaskPenaltyProps {
  penalty?: TaskPenaltyData | null
  projectId: string
  taskId: string
  /** Quien tiene la tarea puede pedir revaluación. */
  canRequest: boolean
  /** Un jefe la resuelve: fecha nueva y, si hace falta, votación nueva. */
  canResolve: boolean
  isAccepted?: boolean
  onChanged?: () => void
}

/**
 * Fecha límite: lo que cuesta pasarse y el botón para evitarlo a tiempo.
 *
 * Pasarse cuesta el valor COMPLETO de la tarea, así que esta franja tiene que
 * ser imposible de ignorar cuando la fecha está encima. Y al lado, la salida
 * honesta: pedir revaluación antes de que el reloj cobre.
 */
export function TaskPenalty({
  penalty,
  projectId,
  taskId,
  canRequest,
  canResolve,
  isAccepted = false,
  onChanged,
}: TaskPenaltyProps) {
  const [isActing, setIsActing] = useState(false)
  const [reason, setReason] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [showForm, setShowForm] = useState(false)

  if (!penalty) return null

  const url = `/api/v1/projects/${projectId}/tasks/${taskId}/revaluation`

  const call = async (body: Record<string, unknown>, ok: string) => {
    setIsActing(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo')
        return
      }
      toast.success(ok)
      setShowForm(false)
      setReason('')
      setNewDueDate('')
      onChanged?.()
    } finally {
      setIsActing(false)
    }
  }

  const { pointsValue, isOverdue, overdueCharged, inRevaluation, hoursLeft } = penalty

  // Una tarea aceptada solo muestra rastro si alguna vez se venció.
  if (isAccepted) {
    if (!overdueCharged) return null
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2.5">
        <p className="text-xs text-gray-400 leading-relaxed">
          <TimerOff className="inline w-3.5 h-3.5 mr-1.5 text-gray-500" />
          Esta tarea se venció antes de entregarse: el descuento sigue en el ledger y la
          aceptación acreditó su valor vigente.
        </p>
      </div>
    )
  }

  if (inRevaluation) {
    return (
      <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2.5 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-blue-300">
          <PauseCircle className="w-3.5 h-3.5" />
          En revaluación · reloj en pausa
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Mientras esté en revaluación no se cobra nada aunque pase la fecha. Los jefes
          deciden una fecha nueva y, si el equipo lo ve distinto, se vuelve a votar.
        </p>

        {canResolve && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              id={`reval-date-${taskId}`}
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-8 rounded-lg bg-gray-800 border border-gray-700 px-2 text-xs text-gray-200"
            />
            <button
              onClick={() =>
                call(
                  { resolve: true, newDueDate: newDueDate || null, reopenVoting: true },
                  'Revaluada: se abrió la votación'
                )
              }
              disabled={isActing}
              className="h-8 px-2.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-xs text-violet-200 hover:bg-violet-500/30 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Nueva fecha y volver a votar
            </button>
            <button
              onClick={() =>
                call(
                  { resolve: true, newDueDate: newDueDate || null, reopenVoting: false },
                  'Revaluación resuelta'
                )
              }
              disabled={isActing}
              className="h-8 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:border-gray-500 disabled:opacity-50"
            >
              Solo cambiar la fecha
            </button>
          </div>
        )}
      </div>
    )
  }

  const urgent = hoursLeft != null && hoursLeft <= 48 && hoursLeft > 0

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-2',
        isOverdue || overdueCharged
          ? 'border-red-500/25 bg-red-500/5'
          : urgent
            ? 'border-amber-500/25 bg-amber-500/5'
            : 'border-gray-800 bg-gray-900/40'
      )}
    >
      {overdueCharged ? (
        <p className="flex items-start gap-1.5 text-xs text-red-300 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Se pasó de la fecha: ya se descontaron{' '}
            <span className="font-semibold tabular-nums">{pointsValue ?? '—'}</span> puntos.
            Si la terminas y te la aceptan, se acredita su valor vigente.
          </span>
        </p>
      ) : isOverdue ? (
        <p className="flex items-start gap-1.5 text-xs text-red-300 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Vencida. En cuanto pase el barrido se descuentan{' '}
            <span className="font-semibold tabular-nums">{pointsValue ?? '—'}</span> puntos:
            lo que vale la tarea.
          </span>
        </p>
      ) : (
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs',
            urgent ? 'text-amber-300' : 'text-gray-400'
          )}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {hoursLeft == null
            ? 'Sin fecha límite: esta tarea no se vence.'
            : hoursLeft < 24
              ? `Quedan ${Math.max(1, Math.round(hoursLeft))} h. Pasarse cuesta ${pointsValue ?? '—'} puntos.`
              : `Quedan ${Math.floor(hoursLeft / 24)} días. Pasarse cuesta ${pointsValue ?? '—'} puntos.`}
        </p>
      )}

      {canRequest && (
        <>
          {showForm ? (
            <div className="space-y-2">
              <input
                id={`reval-reason-${taskId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="¿Con qué te topaste? (opcional)"
                className="w-full h-8 rounded-lg bg-gray-800 border border-gray-700 px-2 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => call({ reason }, 'Pedida: los jefes ya saben')}
                  disabled={isActing}
                  className="h-8 px-2.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  Pedir revaluación
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="h-8 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-200"
            >
              Esto es más duro de lo estimado → pedir revaluación
            </button>
          )}
        </>
      )}
    </div>
  )
}
