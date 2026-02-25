'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TaskCard, TaskCardData } from './TaskCard'

type ColumnStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

const columnConfig: Record<ColumnStatus, { label: string; headerClass: string; dotClass: string }> = {
  TODO: {
    label: 'Por Hacer',
    headerClass: 'text-gray-300 border-gray-600/50',
    dotClass: 'bg-gray-400',
  },
  IN_PROGRESS: {
    label: 'En Progreso',
    headerClass: 'text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  REVIEW: {
    label: 'En Revisión',
    headerClass: 'text-yellow-300 border-yellow-500/30',
    dotClass: 'bg-yellow-400',
  },
  DONE: {
    label: 'Hecho',
    headerClass: 'text-green-300 border-green-500/30',
    dotClass: 'bg-green-400',
  },
  BLOCKED: {
    label: 'Bloqueado',
    headerClass: 'text-red-300 border-red-500/30',
    dotClass: 'bg-red-400',
  },
}

interface KanbanColumnProps {
  status: ColumnStatus
  tasks: TaskCardData[]
  onTaskClick?: (task: TaskCardData) => void
  onAddTask?: (status: ColumnStatus) => void
  /** Expands to full parent width — used in mobile single-column view */
  fullWidth?: boolean
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask, fullWidth }: KanbanColumnProps) {
  const config = columnConfig[status]
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className={cn(fullWidth ? 'w-full' : 'w-64 flex-shrink-0')}>
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 mb-2 rounded-lg border bg-gray-900/50',
          config.headerClass
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', config.dotClass)} />
          <span className="text-sm font-medium">{config.label}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-mono tabular-nums">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask?.(status)}
          className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition-colors"
          title={`Agregar tarea en ${config.label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 rounded-lg p-2 transition-colors duration-150',
          fullWidth ? 'min-h-[300px]' : 'min-h-[200px]',
          isOver ? 'bg-violet-500/5 border border-violet-500/20' : 'bg-gray-900/20'
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-gray-600">Sin tareas</p>
          </div>
        )}
      </div>
    </div>
  )
}
