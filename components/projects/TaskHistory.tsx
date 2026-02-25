'use client'

import { Clock, User, Calendar, Tag, ArrowRight } from 'lucide-react'

interface HistoryEntry {
  id: string
  field: string
  oldValue?: string | null
  newValue?: string | null
  createdAt: string | Date
  user: { id: string; name?: string | null; email: string }
}

interface TaskHistoryProps {
  history: HistoryEntry[]
}

const fieldIcons: Record<string, React.ElementType> = {
  status: Clock,
  assigned_to: User,
  due_date: Calendar,
  priority: Tag,
}

const fieldLabels: Record<string, string> = {
  status: 'Estado',
  assigned_to: 'Asignado a',
  due_date: 'Fecha límite',
  priority: 'Prioridad',
}

const statusLabels: Record<string, string> = {
  TODO: 'Por Hacer',
  IN_PROGRESS: 'En Progreso',
  REVIEW: 'En Revisión',
  DONE: 'Hecho',
  BLOCKED: 'Bloqueado',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

function formatValue(field: string, value: string | null | undefined): string {
  if (!value) return '(sin valor)'
  if (field === 'status') return statusLabels[value] ?? value
  if (field === 'priority') return priorityLabels[value] ?? value
  if (field === 'due_date') {
    try {
      return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value)
      )
    } catch {
      return value
    }
  }
  return value
}

function formatRelative(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d)
}

export function TaskHistory({ history }: TaskHistoryProps) {
  if (history.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">Sin historial de cambios</p>
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => {
        const Icon = fieldIcons[entry.field] ?? Clock
        const fieldLabel = fieldLabels[entry.field] ?? entry.field

        return (
          <div key={entry.id} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300">
                <span className="font-medium text-gray-100">
                  {entry.user.name ?? entry.user.email}
                </span>{' '}
                cambió{' '}
                <span className="text-violet-400">{fieldLabel}</span>
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {entry.oldValue && (
                  <span className="text-xs text-gray-500 line-through">
                    {formatValue(entry.field, entry.oldValue)}
                  </span>
                )}
                {entry.oldValue && entry.newValue && (
                  <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                )}
                {entry.newValue && (
                  <span className="text-xs text-gray-300">{formatValue(entry.field, entry.newValue)}</span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">{formatRelative(entry.createdAt)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
