'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarRange, Play, Flag, Plus, Gauge, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

export interface SprintRow {
  id: string
  name: string
  goal: string | null
  startDate: string
  endDate: string
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED'
  _count?: { tasks: number }
}

interface CapacityRow {
  userId: string
  name: string | null
  email: string
  capacity: number
  committed: number
  accepted: number
}

interface SprintBarProps {
  projectId: string
  canManage: boolean
  /** Filtro vigente del tablero: un id de sprint, 'backlog' o 'all'. null = sin decidir. */
  scope: string | null
  onScopeChange: (scope: string) => void
  /** Avisa al padre para recargar tareas tras arrancar o cerrar un sprint. */
  onChanged?: () => void
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

function firstName(row: CapacityRow) {
  return (row.name || row.email).split(' ')[0]
}

/**
 * Barra del sprint: la caja de tiempo vigente y la capacidad de cada quien.
 *
 * Es el freno visible del sistema — muestra cuánto se comprometió cada persona
 * contra su tope — y el único lugar desde donde se arranca y se cierra un
 * sprint.
 */
export function SprintBar({ projectId, canManage, scope, onScopeChange, onChanged }: SprintBarProps) {
  const [sprints, setSprints] = useState<SprintRow[]>([])
  const [active, setActive] = useState<SprintRow | null>(null)
  const [capacities, setCapacities] = useState<CapacityRow[]>([])
  const [counts, setCounts] = useState<{ total: number; backlog: number }>({ total: 0, backlog: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  // Solo la PRIMERA carga mueve el alcance del tablero al sprint activo;
  // después manda lo que haya elegido la persona.
  const scopeInitialized = useRef(false)

  const url = `/api/v1/projects/${projectId}/sprints`

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setSprints(data.sprints ?? [])
        setActive(data.active ?? null)
        setCapacities(data.capacities ?? [])
        setCounts(data.counts ?? { total: 0, backlog: 0 })
        if (!scopeInitialized.current) {
          scopeInitialized.current = true
          // Siempre se responde algo: la página no pide tareas hasta saber qué
          // mostrar, así que un silencio aquí la dejaría con el tablero vacío.
          onScopeChange(data.active ? data.active.id : 'all')
        }
      }
    } finally {
      setIsLoading(false)
    }
    // `onScopeChange` se omite a propósito: recrear `load` en cada render del
    // padre dispararía la carga en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    load()
  }, [load])

  const act = async (path: string, body?: unknown) => {
    setIsBusy(true)
    try {
      const res = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo completar la acción')
        return null
      }
      await load()
      onChanged?.()
      return data
    } finally {
      setIsBusy(false)
    }
  }

  const createSprint = async () => {
    const created = await act('', {})
    if (created) toast.success(`${created.name} creado`)
  }

  const startSprint = async (sprintId: string) => {
    const started = await act(`/${sprintId}/start`)
    if (started) {
      toast.success(`${started.name} arrancó`)
      onScopeChange(sprintId)
    }
  }

  const closeSprint = async (sprintId: string) => {
    const next = sprints.find((s) => s.status === 'PLANNED')
    const result = await act(`/${sprintId}/close`, { nextSprintId: next?.id ?? null })
    if (result) {
      toast.success(
        result.carriedOver > 0
          ? `Sprint cerrado · ${result.velocity} pts · ${result.carriedOver} tarea(s) arrastrada(s)`
          : `Sprint cerrado · ${result.velocity} pts, sin arrastres`
      )
    }
  }

  if (isLoading) {
    return <div className="h-14 rounded-xl border border-gray-800 bg-gray-900/40 animate-pulse" />
  }

  const shown =
    scope === 'backlog'
      ? counts.backlog
      : scope && scope !== 'all'
        ? sprints.find((s) => s.id === scope)?._count?.tasks ?? 0
        : counts.total
  const hidden = Math.max(0, counts.total - shown)
  const left = active ? daysLeft(active.endDate) : 0
  const totalCommitted = capacities.reduce((sum, c) => sum + c.committed, 0)
  const totalAccepted = capacities.reduce((sum, c) => sum + c.accepted, 0)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-gray-800">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <CalendarRange className="w-4 h-4 text-violet-400" />
          {active ? active.name : 'Sin sprint activo'}
        </span>

        {active ? (
          <>
            <span className="text-xs text-gray-500">
              {shortDate(active.startDate)} – {shortDate(active.endDate)} ·{' '}
              <span className={cn(left <= 2 ? 'text-amber-400' : 'text-gray-400')}>
                {left > 0 ? `quedan ${left} día${left === 1 ? '' : 's'}` : 'termina hoy'}
              </span>
            </span>
            <span className="text-xs text-gray-400 tabular-nums">
              {totalAccepted} de {totalCommitted} pts aceptados
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-500">
            Crea un sprint y arrástrale tareas del backlog para comprometer el trabajo.
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* El alcance del tablero: el sprint corriendo, lo no comprometido, o todo. */}
          <select
            id="sprint-scope"
            value={scope ?? 'all'}
            onChange={(e) => onScopeChange(e.target.value)}
            className="h-8 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2"
          >
            {/* Con el conteo al lado, un tablero filtrado ya no parece haber
                perdido tareas: se ve dónde están las que no salen. */}
            {active && (
              <option value={active.id}>
                Sprint activo ({active._count?.tasks ?? 0})
              </option>
            )}
            <option value="backlog">Backlog ({counts.backlog})</option>
            <option value="all">Todas ({counts.total})</option>
            {sprints
              .filter((s) => s.id !== active?.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s._count?.tasks ?? 0}){s.status === 'CLOSED' ? ' · cerrado' : ''}
                </option>
              ))}
          </select>

          {canManage && (
            <>
              {active ? (
                <button
                  onClick={() => closeSprint(active.id)}
                  disabled={isBusy}
                  className="h-8 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:border-gray-500 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Cerrar
                </button>
              ) : (
                sprints
                  .filter((s) => s.status === 'PLANNED')
                  .slice(0, 1)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => startSprint(s.id)}
                      disabled={isBusy}
                      className="h-8 px-2.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-xs text-violet-200 hover:bg-violet-500/30 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Arrancar {s.name}
                    </button>
                  ))
              )}
              <button
                onClick={createSprint}
                disabled={isBusy}
                className="h-8 px-2.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 hover:border-gray-500 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aviso explícito cuando el tablero no está mostrando todo. */}
      {scope && scope !== 'all' && hidden > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-800 bg-amber-500/5">
          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-300/90">
            {hidden} tarea{hidden === 1 ? '' : 's'} del proyecto no {hidden === 1 ? 'está' : 'están'} en{' '}
            {scope === 'backlog' ? 'el backlog' : 'este sprint'}, así que no {hidden === 1 ? 'aparece' : 'aparecen'} en el tablero.
          </span>
          <button
            onClick={() => onScopeChange('all')}
            className="text-xs text-amber-200 underline underline-offset-2 hover:text-amber-100"
          >
            Ver todas
          </button>
        </div>
      )}

      {active && capacities.length > 0 && (
        <div className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 mb-2">
            <Gauge className="w-3.5 h-3.5" />
            Capacidad comprometida
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {capacities.map((row) => {
              const ratio = row.capacity > 0 ? row.committed / row.capacity : 0
              const full = ratio >= 1
              return (
                <div key={row.userId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-gray-300 truncate">{firstName(row)}</span>
                    <span
                      className={cn(
                        'tabular-nums',
                        full ? 'text-amber-400' : 'text-gray-500'
                      )}
                    >
                      {row.committed} / {row.capacity} pts
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    {/* Aceptado dentro de comprometido: el avance real del sprint. */}
                    <div
                      className={cn('h-full rounded-full', full ? 'bg-amber-500/70' : 'bg-violet-500/70')}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                  {row.accepted > 0 && (
                    <p className="text-[11px] text-gray-600 tabular-nums">
                      {row.accepted} pts aceptados
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
