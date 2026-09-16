'use client'

import { useCallback, useEffect, useState } from 'react'
import { Vote, AlertTriangle, Lock, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { FIBONACCI_SCALE, SCALE_ANCHORS } from '@/lib/services/point-scale'
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
  /** Peldaños que se pueden votar (Fibonacci recortado por la configuración). */
  scale: number[]
  isEpic: boolean
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
  // Ancla que se muestra debajo de los botones: la del peldaño que la persona
  // está mirando. Sin anclas la escala se infla sola con el tiempo.
  const [previewed, setPreviewed] = useState<number | null>(null)

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
  const scale = state.scale?.length ? state.scale : [...FIBONACCI_SCALE]
  const anchorFor = previewed ?? state.myVote
  const anchor = anchorFor != null ? SCALE_ANCHORS[anchorFor] : null

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
                  : 'nadie votó, se aplicó el mínimo de la escala'}
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
                {scale.map((value) => (
                  <button
                    key={value}
                    onClick={() => handleVote(value)}
                    onMouseEnter={() => setPreviewed(value)}
                    onMouseLeave={() => setPreviewed(null)}
                    onFocus={() => setPreviewed(value)}
                    onBlur={() => setPreviewed(null)}
                    disabled={isVoting}
                    title={
                      SCALE_ANCHORS[value]
                        ? `${SCALE_ANCHORS[value].label} — ${SCALE_ANCHORS[value].hint}`
                        : undefined
                    }
                    className={cn(
                      'w-9 h-9 rounded-lg border text-sm font-medium tabular-nums transition-colors disabled:opacity-50',
                      state.myVote === value
                        ? 'bg-violet-500/25 border-violet-500/60 text-violet-200'
                        : value === scale[scale.length - 1]
                          ? 'bg-gray-800 border-amber-500/40 text-amber-300/90 hover:border-amber-400 hover:text-amber-200'
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

            <p className="min-h-[1.25rem] text-[11px] leading-5 text-gray-500">
              {anchor ? (
                <>
                  <span className="font-mono text-violet-300">{anchorFor}</span>{' '}
                  = {anchor.label}
                  <span className="text-gray-600"> · {anchor.hint}</span>
                </>
              ) : (
                <span className="text-gray-600">
                  Pasa por encima de un número para ver a qué equivale.
                </span>
              )}
            </p>

            <p className="text-xs text-gray-500">
              {state.voteCount} de {state.eligibleVoterCount} voto
              {state.eligibleVoterCount === 1 ? '' : 's'} · faltan{' '}
              {Math.max(0, state.quorum - state.voteCount)} para el quórum
              {state.myVote != null && ` · tu voto: ${state.myVote}`}
            </p>

            {/* Durante la votación solo se muestra el conteo: destapar quién votó
                qué anclaría a los que faltan. Los votos se revelan al cerrar. */}
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Estima el <span className="text-gray-500">tamaño</span> de la
              tarea, no quién la hace: complejidad, incertidumbre y esfuerzo. La
              votación cierra apenas voten los {state.eligibleVoterCount} o al
              vencer el plazo, y el valor final es la mediana llevada al peldaño
              más cercano. Los votos individuales se revelan al cerrar.
            </p>
          </>
        )}

        {isClosed && state.isEpic && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-amber-300 leading-relaxed">
              Épica: el equipo la estimó en el tope de la escala. Pártanla en
              tareas más chicas antes de trabajarla; una tarea de semanas es una
              apuesta, no una estimación.
            </span>
          </div>
        )}

        {state.needsDiscussion && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-amber-300 leading-relaxed">
              Necesita discusión: los votos quedaron a dos peldaños o más de
              distancia. El valor de la mediana igual aplica.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
