'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TaskCardData } from './TaskCard'

interface ListViewProps {
  tasks: TaskCardData[]
  onTaskClick?: (task: TaskCardData) => void
}

type SortField = 'title' | 'status' | 'priority' | 'dueDate'
type SortDir = 'asc' | 'desc'

const statusOrder = { TODO: 0, IN_PROGRESS: 1, REVIEW: 2, BLOCKED: 3, DONE: 4 }
const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const statusConfig = {
  TODO: { label: 'Por Hacer', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  IN_PROGRESS: { label: 'En Progreso', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  REVIEW: { label: 'En Revisión', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  DONE: { label: 'Hecho', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  BLOCKED: { label: 'Bloqueado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const priorityConfig = {
  LOW: { label: 'Baja', className: 'text-gray-400' },
  MEDIUM: { label: 'Media', className: 'text-blue-400' },
  HIGH: { label: 'Alta', className: 'text-orange-400' },
  URGENT: { label: 'Urgente', className: 'text-red-400' },
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronUp className="w-3 h-3 opacity-20" />
  return sortDir === 'asc' ? (
    <ChevronUp className="w-3 h-3 text-violet-400" />
  ) : (
    <ChevronDown className="w-3 h-3 text-violet-400" />
  )
}

export function ListView({ tasks, onTaskClick }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'title':
        cmp = a.title.localeCompare(b.title)
        break
      case 'status':
        cmp = statusOrder[a.status] - statusOrder[b.status]
        break
      case 'priority':
        cmp = priorityOrder[a.priority] - priorityOrder[b.priority]
        break
      case 'dueDate': {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        cmp = da - db
        break
      }
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns: { key: SortField; label: string; className?: string }[] = [
    { key: 'title', label: 'Título', className: 'flex-1' },
    { key: 'status', label: 'Estado', className: 'w-32' },
    { key: 'priority', label: 'Prioridad', className: 'w-24' },
    { key: 'dueDate', label: 'Fecha límite', className: 'w-32' },
  ]

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 bg-gray-900 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider">
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={cn(
              'flex items-center gap-1 hover:text-gray-300 transition-colors',
              col.className
            )}
          >
            {col.label}
            <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />
          </button>
        ))}
        <div className="w-32 text-right">Asignado</div>
        <div className="w-24 text-right">Horas</div>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No hay tareas que mostrar</div>
      ) : (
        sorted.map((task) => {
          const status = statusConfig[task.status]
          const priority = priorityConfig[task.priority]
          const overdue = task.dueDate && new Date(task.dueDate) < new Date()

          return (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className="flex items-center px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors group"
            >
              {/* Title */}
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm text-gray-100 truncate group-hover:text-white transition-colors">
                  {task.title}
                </p>
                {task.tags && task.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {task.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-xs text-violet-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="w-32">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
                    status.className
                  )}
                >
                  {status.label}
                </span>
              </div>

              {/* Priority */}
              <div className={cn('w-24 text-xs font-medium', priority.className)}>
                {priority.label}
              </div>

              {/* Due date */}
              <div className={cn('w-32 flex items-center gap-1 text-xs', overdue ? 'text-red-400' : 'text-gray-400')}>
                {task.dueDate ? (
                  <>
                    <Calendar className="w-3 h-3" />
                    {new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(
                      new Date(task.dueDate)
                    )}
                  </>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </div>

              {/* Assignee */}
              <div className="w-32 flex justify-end">
                {task.assignedUser ? (
                  <div
                    className="w-6 h-6 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center justify-center text-xs font-medium text-violet-300"
                    title={task.assignedUser.name ?? task.assignedUser.email}
                  >
                    {(task.assignedUser.name ?? task.assignedUser.email).charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <span className="text-gray-600 text-xs">—</span>
                )}
              </div>

              {/* Hours */}
              <div className="w-24 flex justify-end items-center gap-1 text-xs text-gray-500">
                {task.estimatedHours ? (
                  <>
                    <Clock className="w-3 h-3" />
                    <span>
                      {task.actualHours ?? 0}/{task.estimatedHours}h
                    </span>
                  </>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
