'use client'

import { useCallback, useEffect, useState } from 'react'
import { Vote, AlertTriangle, Lock, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

interface VoteRow {
  userId: string
  value: number
  user: { id: string; name?: string | null; email: string; image?: string | null }
}

interface VotingState {
  valuationStatus: 'VOTING' | 'EXTENDED' | 'VALUED'
  pointsValue: number | null
  needsDiscussion: boolean
  votingClosesAt: string | null
  minPoints: number
  maxPoints: number
  quorum: number
  eligibleVoterCount: number
  voteCount: number
  myVote: number | null
  canVote: boolean
  reason: string | null
  votes: VoteRow[]
}

interface TaskVotingProps {
  projectId: string
  taskId: string
  /** Notifica al panel para refrescar el valor en la tarjeta. */
  onSettled?: () => void
}

function formatRemaining(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now()
  if (ms <= 0) return 'cerrando...'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `cierra en ${hours}h`
  return `cierra en ${Math.max(1, Math.floor(ms / 60_000))} min`
}

export function TaskVoting({ projectId, taskId, onSettled }: TaskVotingProps) {
  const [state, setState] = useState<VotingState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)

  const url = `/api/v1/projects/${projectId}/tasks/${taskId}/votes`

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

  const handleVote = async (value: number) => {
    if (isVoting) return
    setIsVoting(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setState(data)
        toast.success(`Votaste ${value} puntos`)
        if (data?.valuationStatus === 'VALUED') onSettled?.()
      } else {
        toast.error(data?.error || 'No se pudo registrar el voto')
        // La ventana pudo cerrarse mientras el panel estaba abierto.
        load()
      }
    } finally {
      setIsVoting(false)
    }
  }

  if (isLoading || !state) {
    return (
      <div className="rounded-lg border border-gray-800 px-3 py-2.5">
        <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
    )
  }

  const isClosed = state.valuationStatus === 'VALUED'
  const range = Array.from(
    { length: state.maxPoints - state.minPoints + 1 },
    (_, i) => state.minPoints + i
  )

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900/60 border-b border-gray-800">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
          <Vote className="w-3.5 h-3.5 text-violet-400" />
          Valor en puntos
        </span>
        {isClosed ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Lock className="w-3 h-3" />
            Votación cerrada
          </span>
        ) : (
          state.votingClosesAt && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Clock3 className="w-3 h-3" />
              {formatRemaining(state.votingClosesAt)}
            </span>
          )
        )}
      </div>

      <div className="px-3 py-3 space-y-3">
        {isClosed ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-100 tabular-nums">
                {state.pointsValue ?? '—'}
              </span>
              <span className="text-xs text-gray-500">
                puntos ·{' '}
                {state.voteCount > 0
                  ? `mediana de ${state.voteCount} voto${state.voteCount === 1 ? '' : 's'}`
                  : 'sin votos, se aplicó el mínimo'}
              </span>
            </div>

            {state.votes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {state.votes.map((v) => (
                  <span
                    key={v.userId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-gray-800 text-gray-300 border border-gray-700"
                    title={v.user.name || v.user.email}
                  >
                    {(v.user.name || v.user.email).split(' ')[0]}
                    <span className="font-mono text-violet-300">{v.value}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {state.canVote ? (
              <div className="flex flex-wrap gap-1.5">
                {range.map((value) => (
                  <button
                    key={value}
                    onClick={() => handleVote(value)}
                    disabled={isVoting}
                    className={cn(
                      'w-9 h-9 rounded-lg border text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                      state.myVote === value
                        ? 'bg-violet-500/25 border-violet-500/60 text-violet-200'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-gray-100'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">{state.reason ?? 'No puedes votar esta tarea'}</p>
            )}

            <p className="text-xs text-gray-500">
              {state.voteCount} de {state.eligibleVoterCount} voto
              {state.eligibleVoterCount === 1 ? '' : 's'} · faltan{' '}
              {Math.max(0, state.quorum - state.voteCount)} para el quórum
              {state.myVote != null && ` · tu voto: ${state.myVote}`}
            </p>

            {/* Durante la votación solo se muestra el conteo: destapar quién votó
                qué anclaría a los que faltan. Los votos se revelan al cerrar. */}
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Los votos individuales se revelan cuando cierre la votación. Sin
              quórum, la tarea toma el mínimo ({state.minPoints} puntos).
            </p>
          </>
        )}

        {state.needsDiscussion && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-amber-300 leading-relaxed">
              Necesita discusión: los votos quedaron muy dispersos. El valor de
              la mediana igual aplica.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
