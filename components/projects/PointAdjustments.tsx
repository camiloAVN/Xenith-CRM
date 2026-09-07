'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gift, Plus, Minus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

interface Participant {
  id: string
  name: string | null
  email: string
}

interface Adjustment {
  id: string
  points: number
  note: string | null
  createdAt: string
  user: Participant
  createdBy: Participant | null
}

interface AdjustmentsPayload {
  adjustments: Adjustment[]
  participants: Participant[]
  canAdjust: boolean
}

interface PointAdjustmentsProps {
  projectId: string
  /** Se llama tras asignar puntos para refrescar gráficos y porcentajes. */
  onChanged?: () => void
}

const dateFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Asignación manual de puntos por parte del dueño.
 *
 * Es la única vía que mueve el reparto sin votación ni aprobación, así que el
 * historial queda a la vista de todo el equipo aunque solo el dueño pueda
 * escribir en él.
 */
export function PointAdjustments({ projectId, onChanged }: PointAdjustmentsProps) {
  const [data, setData] = useState<AdjustmentsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [userId, setUserId] = useState('')
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')

  const url = `/api/v1/projects/${projectId}/contributions/adjustments`

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (res.ok) setData(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    load()
  }, [load])

  const parsed = Number(points)
  const canSubmit = userId !== '' && points.trim() !== '' && Number.isFinite(parsed) && parsed !== 0

  const submit = async () => {
    if (!canSubmit || isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, points: parsed, note: note.trim() || null }),
      })
      const body = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(
          `${parsed > 0 ? '+' : ''}${parsed} puntos asignados`
        )
        setUserId('')
        setPoints('')
        setNote('')
        await load()
        onChanged?.()
      } else {
        toast.error(body?.error || 'No se pudieron asignar los puntos')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !data) return null
  // Sin ajustes y sin permiso para crearlos, la sección no aporta nada.
  if (!data.canAdjust && data.adjustments.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-900/60 border-b border-gray-800">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
          <Gift className="w-4 h-4 text-violet-400" />
          Puntos asignados a mano
        </span>
        {data.canAdjust && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <ShieldCheck className="w-3 h-3" />
            solo el dueño
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {data.canAdjust && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Participante</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="">Escoge a quién</option>
                  {data.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:w-32">
                <label className="text-xs text-gray-500 block mb-1.5">Puntos</label>
                <input
                  type="number"
                  step="0.5"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="Ej: 5"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 tabular-nums placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Motivo (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: trabajo previo al sistema de puntos"
                maxLength={500}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-gray-600 leading-relaxed max-w-md">
                Los puntos entran al mismo ledger y mueven los porcentajes al
                instante. Un valor negativo descuenta: para corregir un ajuste
                de más se agrega el opuesto, nunca se borra el original.
              </p>
              <button
                onClick={submit}
                disabled={!canSubmit || isSaving}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                  'bg-violet-500/15 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                <Plus className="w-4 h-4" />
                {isSaving ? 'Asignando...' : 'Asignar puntos'}
              </button>
            </div>
          </div>
        )}

        {data.adjustments.length > 0 && (
          <div className={cn('space-y-2', data.canAdjust && 'pt-3 border-t border-gray-800')}>
            {data.adjustments.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="text-gray-200">{a.user.name || a.user.email}</span>
                  {a.note && (
                    <span className="block text-xs text-gray-500 truncate">{a.note}</span>
                  )}
                  <span className="block text-[11px] text-gray-600">
                    {dateFmt.format(new Date(a.createdAt))}
                    {a.createdBy && ` · por ${a.createdBy.name || a.createdBy.email}`}
                  </span>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 tabular-nums font-semibold flex-shrink-0',
                    a.points > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {a.points > 0 ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {Math.abs(a.points)}
                  <span className="font-normal text-gray-600 ml-0.5">pts</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
