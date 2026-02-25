'use client'

import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ProjectProgressProps {
  progress: {
    total: number
    done: number
    inProgress: number
    review: number
    blocked: number
    todo: number
    percentage: number
    estimatedHours: number
    actualHours: number
  }
  className?: string
}

const statusBars = [
  { key: 'done', label: 'Hecho', color: 'bg-green-500' },
  { key: 'inProgress', label: 'En Progreso', color: 'bg-blue-500' },
  { key: 'review', label: 'En Revisión', color: 'bg-yellow-500' },
  { key: 'blocked', label: 'Bloqueado', color: 'bg-red-500' },
  { key: 'todo', label: 'Por Hacer', color: 'bg-gray-600' },
] as const

export function ProjectProgress({ progress, className }: ProjectProgressProps) {
  const { total, percentage, estimatedHours, actualHours } = progress
  const hoursRatio = estimatedHours > 0 ? Math.min((actualHours / estimatedHours) * 100, 100) : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Percentage donut-style */}
      <div className="flex items-center gap-4">
        {/* Circle */}
        <div className="relative flex-shrink-0">
          <svg width={64} height={64} viewBox="0 0 64 64" className="-rotate-90">
            <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
            <circle
              cx={32}
              cy={32}
              r={26}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={8}
              strokeDasharray={`${(percentage / 100) * 163.36} 163.36`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
            {percentage}%
          </span>
        </div>

        {/* Counts */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {statusBars.map(({ key, label, color }) => {
            const count = progress[key]
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', color)} />
                <span className="text-gray-400">{label}</span>
                <span className="ml-auto font-medium text-gray-200">{count}</span>
              </div>
            )
          })}
          <div className="col-span-2 flex items-center gap-1.5 mt-1 pt-1 border-t border-gray-800">
            <span className="text-gray-500">Total</span>
            <span className="ml-auto font-medium text-gray-200">{total} tareas</span>
          </div>
        </div>
      </div>

      {/* Stacked bar */}
      {total > 0 && (
        <div className="h-2 rounded-full overflow-hidden bg-gray-800 flex">
          {statusBars.map(({ key, color }) => {
            const pct = (progress[key] / total) * 100
            if (pct === 0) return null
            return (
              <div
                key={key}
                className={cn('h-full', color)}
                style={{ width: `${pct}%` }}
                title={`${progress[key]} ${key}`}
              />
            )
          })}
        </div>
      )}

      {/* Hours */}
      {estimatedHours > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3" />
              Horas
            </span>
            <span className="text-gray-300 font-medium">
              {actualHours}h / {estimatedHours}h
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-gray-800">
            <div
              className={cn('h-full rounded-full', hoursRatio >= 100 ? 'bg-red-500' : 'bg-violet-500')}
              style={{ width: `${hoursRatio}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
