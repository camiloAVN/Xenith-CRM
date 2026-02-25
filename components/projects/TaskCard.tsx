'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Clock, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface TaskCardData {
  id: string
  title: string
  description?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string | Date | null
  estimatedHours?: number | null
  actualHours?: number | null
  tags?: string[]
  assignedUser?: { id: string; name?: string | null; email: string; image?: string | null } | null
}

const priorityConfig = {
  LOW: { label: 'Baja', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  MEDIUM: { label: 'Media', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  HIGH: { label: 'Alta', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  URGENT: { label: 'Urgente', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

function getUserInitial(user: { name?: string | null; email: string }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

function isOverdue(dueDate: string | Date | null | undefined) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(date))
}

interface TaskCardProps {
  task: TaskCardData
  onClick?: () => void
  isDragging?: boolean
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const priority = priorityConfig[task.priority]
  const overdue = isOverdue(task.dueDate)
  const hasHours = task.estimatedHours && task.estimatedHours > 0
  const hoursProgress = hasHours
    ? Math.min(((task.actualHours ?? 0) / task.estimatedHours!) * 100, 100)
    : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-gray-800/80 border border-gray-700/50 rounded-lg p-3 cursor-pointer',
        'hover:border-violet-500/40 hover:bg-gray-800 transition-all duration-150',
        isDragging && 'shadow-2xl shadow-violet-500/20 rotate-1 scale-105'
      )}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 p-0.5 opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Priority badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border',
            priority.className
          )}
        >
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-100 leading-snug pr-6 mb-2 line-clamp-2">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-xs rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs text-gray-500">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Hours progress bar */}
      {hasHours && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.actualHours ?? 0}h / {task.estimatedHours}h
            </span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                hoursProgress >= 100 ? 'bg-red-500' : 'bg-violet-500'
              )}
              style={{ width: `${hoursProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div className="flex items-center justify-between mt-2">
        {task.assignedUser ? (
          <div
            className="w-6 h-6 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center justify-center text-xs font-medium text-violet-300"
            title={task.assignedUser.name ?? task.assignedUser.email}
          >
            {getUserInitial(task.assignedUser)}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
            <span className="text-gray-500 text-xs">?</span>
          </div>
        )}

        {task.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'text-red-400' : 'text-gray-400'
            )}
          >
            <Calendar className="w-3 h-3" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}
