'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Hourglass,
  ShieldCheck,
  RotateCcw,
  Vote,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

interface ApprovalRow {
  userId: string
  approved: boolean
  comment: string | null
  createdAt: string
  user: { id: string; name?: string | null; email: string; image?: string | null }
}

interface ApprovalState {
  completionStatus: 'PENDING' | 'SUBMITTED' | 'ACCEPTED'
  completionRound: number
  requiredApproverIds: string[]
  approvals: ApprovalRow[]
  approvedCount: number
  waitingForValuation: boolean
  canReview: boolean
  reason: string | null
  pointsValue: number | null
  effectivePoints: number | null
  acceptedAt: string | null
}

interface TaskApprovalProps {
  projectId: string
  taskId: string
  /** Solo los jefes ven la acción de reabrir. */
  canManageTasks?: boolean
  /** Refresca la tarjeta cuando cambia el estado. */
  onChanged?: () => void
}

export function TaskApproval({
  projectId,
  taskId,
  canManageTasks = false,
  onChanged,
}: TaskApprovalProps) {
  const [state, setState] = useState<ApprovalState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)

  const url = `/api/v1/projects/${projectId}/tasks/${taskId}/approvals`

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (res.ok) setState(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    setIsLoading(true)
    load()
  }, [load])

  const review = async (approved: boolean) => {
    if (isActing) return
    const comment = approved
      ? null
      : window.prompt('¿Por qué se rechaza? (opcional)') ?? null
    setIsActing(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, comment }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setState(data)
        if (data?.accepted) {
          toast.success(`Aceptada — ${data.effectivePoints} puntos acreditados`)
        } else if (data?.rejected) {
          toast.success('Rechazada. Vuelve a "en progreso".')
        } else if (data?.waitingForValuation) {
          toast.success('Aprobada. Falta que cierre la votación para acreditar.')
        } else {
          toast.success('Aprobada. Faltan otros jefes.')
        }
        onChanged?.()
      } else {
        toast.error(data?.error || 'No se pudo registrar la revisión')
        load()
      }
    } finally {
      setIsActing(false)
    }
  }

  const reopen = async () => {
    if (isActing) return
    if (
      !window.confirm(
        'Reabrir esta tarea revierte los puntos ya acreditados. ¿Continuar?'
      )
    )
      return
    setIsActing(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(`Tarea reabierta — se revirtieron ${data?.reverted ?? 0} puntos`)
        load()
        onChanged?.()
      } else {
        toast.error(data?.error || 'No se pudo reabrir la tarea')
      }
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading || !state) return null
  // En "en progreso" no hay nada que revisar todavía.
  if (state.completionStatus === 'PENDING') return null

  const pending = state.requiredApproverIds.filter(
    (id) => !state.approvals.some((a) => a.userId === id && a.approved)
  )

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900/60 border-b border-gray-800">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
          Aceptación de cumplimiento
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {state.approvedCount} de {state.requiredApproverIds.length} jefe
          {state.requiredApproverIds.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="px-3 py-3 space-y-3">
        {state.completionStatus === 'ACCEPTED' ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-300">
              Cumplimiento aceptado
              {state.effectivePoints != null && (
                <span className="block text-xs text-gray-400 mt-0.5">
                  {state.effectivePoints} puntos acreditados
                  {state.pointsValue != null &&
                    state.pointsValue !== state.effectivePoints &&
                    ` (valor ${state.pointsValue} menos la penalización por retraso)`}
                </span>
              )}
            </div>
          </div>
        ) : state.waitingForValuation ? (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Vote className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-blue-300 leading-relaxed">
              Esperando que cierre la votación de puntos. En cuanto cierre, los
              puntos se acreditan solos si ya están todas las aprobaciones.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <Hourglass className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-300">
              Terminada — faltan {pending.length} aprobación
              {pending.length === 1 ? '' : 'es'}
            </span>
          </div>
        )}

        {state.approvals.length > 0 && (
          <div className="space-y-1.5">
            {state.approvals.map((a) => (
              <div key={a.userId} className="flex items-start gap-2 text-xs">
                {a.approved ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-gray-300">{a.user.name || a.user.email}</span>
                  <span className="text-gray-600">
                    {' '}
                    · {a.approved ? 'aprobó' : 'rechazó'}
                  </span>
                  {a.comment && (
                    <p className="text-gray-500 mt-0.5 break-words">{a.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.canReview && state.completionStatus === 'SUBMITTED' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => review(true)}
              disabled={isActing}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                'bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25'
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              Aceptar
            </button>
            <button
              onClick={() => review(false)}
              disabled={isActing}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                'bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20'
              )}
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          </div>
        )}

        {!state.canReview && state.completionStatus === 'SUBMITTED' && state.reason && (
          <p className="text-xs text-gray-500">{state.reason}</p>
        )}

        {state.completionStatus === 'ACCEPTED' && canManageTasks && (
          <button
            onClick={reopen}
            disabled={isActing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-800 hover:border-gray-600 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reabrir y revertir puntos
          </button>
        )}
      </div>
    </div>
  )
}
