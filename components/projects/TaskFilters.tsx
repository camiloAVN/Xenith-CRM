'use client'

import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface User {
  id: string
  name?: string | null
  email: string
}

interface Filters {
  search: string
  status: string[]
  priority: string[]
  assignedTo: string
  dueDateFrom: string
  dueDateTo: string
}

interface TaskFiltersProps {
  users?: User[]
  filters: Filters
  onChange: (filters: Filters) => void
}

const STATUS_OPTIONS = [
  { value: 'TODO',        label: 'Por Hacer' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'REVIEW',      label: 'En Revisión' },
  { value: 'DONE',        label: 'Hecho' },
  { value: 'BLOCKED',     label: 'Bloqueado' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

export function TaskFilters({ users = [], filters, onChange }: TaskFiltersProps) {
  const [showMore, setShowMore] = useState(false)

  const hasActive =
    filters.search ||
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.assignedTo ||
    filters.dueDateFrom ||
    filters.dueDateTo

  const toggleMulti = (field: 'status' | 'priority', value: string) => {
    const cur = filters[field]
    onChange({ ...filters, [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] })
  }

  const clear = () =>
    onChange({ search: '', status: [], priority: [], assignedTo: '', dueDateFrom: '', dueDateTo: '' })

  return (
    <div className="space-y-2">
      {/* ── Always-visible row: search + toggle + clear ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar tareas..."
            className="w-full pl-8 pr-3 h-8 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Toggle advanced */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border font-medium transition-colors',
            showMore || hasActive
              ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filtros</span>
          {hasActive && !showMore && (
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          )}
        </button>

        {hasActive && (
          <button
            onClick={clear}
            className="flex items-center gap-1 h-8 px-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}

        {/* Active filter summary chips (visible when panel closed) */}
        {!showMore && (
          <div className="flex gap-1 flex-wrap">
            {filters.status.map((s) => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {STATUS_OPTIONS.find((o) => o.value === s)?.label}
                <button onClick={() => toggleMulti('status', s)} className="hover:text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {filters.priority.map((p) => (
              <span key={p} className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {PRIORITY_OPTIONS.find((o) => o.value === p)?.label}
                <button onClick={() => toggleMulti('priority', p)} className="hover:text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Expanded filters panel ── */}
      {showMore && (
        <div className="pt-2 border-t border-gray-800 space-y-3">
          {/* Status */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Estado</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleMulti('status', opt.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors font-medium',
                    filters.status.includes(opt.value)
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Prioridad</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleMulti('priority', opt.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors font-medium',
                    filters.priority.includes(opt.value)
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee + Date range */}
          <div className="flex flex-wrap gap-3 items-end">
            {users.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Asignado a</p>
                <select
                  value={filters.assignedTo}
                  onChange={(e) => onChange({ ...filters, assignedTo: e.target.value })}
                  className="h-8 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-violet-500 px-2 transition-colors"
                >
                  <option value="">Todos</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-1.5">Fecha límite</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filters.dueDateFrom}
                  onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value })}
                  className="h-8 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-violet-500 px-2 transition-colors"
                />
                <span className="text-gray-600 text-xs">—</span>
                <input
                  type="date"
                  value={filters.dueDateTo}
                  onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value })}
                  className="h-8 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-violet-500 px-2 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
