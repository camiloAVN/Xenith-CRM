'use client'

import { useMemo, useRef, useEffect, useCallback } from 'react'
import { TaskCardData } from './TaskCard'
import { cn } from '@/lib/utils/cn'

interface GanttViewProps {
  tasks: TaskCardData[]
  projectStart?: string | Date | null
  projectEnd?: string | Date | null
  onTaskClick?: (task: TaskCardData) => void
}

const STATUS_COLORS: Record<string, string> = {
  TODO:        '#6b7280',
  IN_PROGRESS: '#3b82f6',
  REVIEW:      '#eab308',
  DONE:        '#22c55e',
  BLOCKED:     '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  TODO:        'Por Hacer',
  IN_PROGRESS: 'En Progreso',
  REVIEW:      'En Revisión',
  DONE:        'Hecho',
  BLOCKED:     'Bloqueado',
}

const ROW_HEIGHT    = 36   // px — must match label row height
const HEADER_HEIGHT = 48   // px — calendar header
const DAY_WIDTH     = 32   // px per day
const LABEL_W       = 200  // px — left label panel width

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

export function GanttView({ tasks, projectStart, projectEnd, onTaskClick }: GanttViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const labelsRef   = useRef<HTMLDivElement>(null)

  const tasksWithDate = useMemo(() => tasks.filter((t) => t.dueDate), [tasks])

  // ── Date range ──────────────────────────────────────────────────────────
  const { rangeStart, totalDays } = useMemo(() => {
    const dates: Date[] = []
    if (projectStart) dates.push(new Date(projectStart))
    if (projectEnd)   dates.push(new Date(projectEnd))
    tasksWithDate.forEach((t) => dates.push(new Date(t.dueDate!)))

    if (dates.length === 0) {
      const now = new Date()
      return { rangeStart: startOfDay(addDays(now, -7)), totalDays: 35 }
    }

    const min   = startOfDay(new Date(Math.min(...dates.map((d) => d.getTime()))))
    const max   = startOfDay(new Date(Math.max(...dates.map((d) => d.getTime()))))
    const start = addDays(min, -7)
    const end   = addDays(max, 10)
    const totalDays = Math.max(21, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    return { rangeStart: start, totalDays }
  }, [tasksWithDate, projectStart, projectEnd])

  const today   = startOfDay(new Date())
  const todayIdx = Math.floor((today.getTime() - rangeStart.getTime()) / 86400000)

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, totalDays]
  )

  // ── SVG dimensions (timeline only, no label column) ────────────────────
  const svgWidth  = totalDays * DAY_WIDTH
  const svgHeight = HEADER_HEIGHT + tasksWithDate.length * ROW_HEIGHT + 8

  // ── Scroll to today on mount ──────────────────────────────────────────
  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const todayX = todayIdx * DAY_WIDTH + DAY_WIDTH / 2
      el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2)
    })
  }, [todayIdx])

  // ── Sync vertical scroll: timeline → labels ───────────────────────────
  const syncScroll = useCallback(() => {
    if (labelsRef.current && timelineRef.current) {
      labelsRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }, [])

  if (tasksWithDate.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
        <p className="text-sm text-gray-500">No hay tareas con fecha límite definida</p>
        <p className="text-xs text-gray-600">Agrega fechas límite a las tareas para verlas en el Gantt</p>
      </div>
    )
  }

  const todayX = todayIdx * DAY_WIDTH + DAY_WIDTH / 2

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden flex flex-col w-full">

      {/* ── Main area: labels (fixed) + timeline (scrollable) ── */}
      <div
        className="flex overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 300px)', minHeight: 240 }}
      >
        {/* ── LEFT: sticky label panel ── */}
        <div
          ref={labelsRef}
          className="flex-shrink-0 flex flex-col overflow-y-hidden border-r border-gray-800"
          style={{ width: LABEL_W }}
        >
          {/* Header cell — same height as calendar header */}
          <div
            className="flex-shrink-0 flex items-end px-3 pb-2 border-b border-gray-800 bg-gray-900"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tarea</span>
          </div>

          {/* Task label rows */}
          {tasksWithDate.map((task, i) => {
            const overdue = new Date(task.dueDate!) < today && task.status !== 'DONE'
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className={cn(
                  'flex-shrink-0 flex items-center px-3 cursor-pointer select-none transition-colors',
                  i % 2 === 1 ? 'bg-gray-900/60' : 'bg-gray-950',
                  'hover:bg-gray-800/70 border-b border-gray-800/50'
                )}
                style={{ height: ROW_HEIGHT }}
                title={task.title}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[task.status] ?? '#6b7280' }}
                  />
                  <span className={cn(
                    'text-xs truncate',
                    overdue ? 'text-red-400' : 'text-gray-300'
                  )}>
                    {task.title}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── RIGHT: scrollable timeline ── */}
        <div
          ref={timelineRef}
          onScroll={syncScroll}
          className="flex-1 overflow-x-auto overflow-y-auto"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#374151 transparent',
          } as React.CSSProperties}
        >
          <svg
            width={svgWidth}
            height={svgHeight}
            style={{ display: 'block', minWidth: svgWidth }}
          >
            {/* ── Day column backgrounds & grid ── */}
            {days.map((day, i) => {
              const x         = i * DAY_WIDTH
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const isToday   = i === todayIdx
              return (
                <g key={i}>
                  {isWeekend && (
                    <rect x={x} y={0} width={DAY_WIDTH} height={svgHeight}
                      fill="rgba(255,255,255,0.02)" />
                  )}
                  {isToday && (
                    <rect x={x} y={0} width={DAY_WIDTH} height={svgHeight}
                      fill="rgba(139,92,246,0.08)" />
                  )}
                  <line x1={x} y1={HEADER_HEIGHT} x2={x} y2={svgHeight}
                    stroke="rgba(255,255,255,0.045)" strokeWidth={1} />
                </g>
              )
            })}

            {/* ── Calendar header ── */}
            {/* Month labels */}
            {days.map((day, i) => {
              const x         = i * DAY_WIDTH
              const showMonth = i === 0 || day.getDate() === 1
              const isToday   = i === todayIdx
              return (
                <g key={`h${i}`}>
                  {showMonth && (
                    <text x={x + 3} y={16} fontSize={9} fontWeight="700"
                      fill="rgba(255,255,255,0.45)">
                      {new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' })
                        .format(day)
                        .toUpperCase()}
                    </text>
                  )}
                  <text
                    x={x + DAY_WIDTH / 2} y={36}
                    fontSize={9} textAnchor="middle"
                    fontWeight={isToday ? '700' : '400'}
                    fill={isToday ? 'rgba(139,92,246,1)' : 'rgba(255,255,255,0.3)'}
                  >
                    {day.getDate()}
                  </text>
                </g>
              )
            })}

            {/* Header/body divider */}
            <line x1={0} y1={HEADER_HEIGHT} x2={svgWidth} y2={HEADER_HEIGHT}
              stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* ── Today marker line ── */}
            {todayIdx >= 0 && todayIdx < totalDays && (
              <>
                <line
                  x1={todayX} y1={HEADER_HEIGHT}
                  x2={todayX} y2={svgHeight}
                  stroke="rgba(139,92,246,0.6)" strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {/* Today label bubble */}
                <rect x={todayX - 14} y={HEADER_HEIGHT - 14} width={28} height={14}
                  rx={3} fill="rgba(139,92,246,0.85)" />
                <text x={todayX} y={HEADER_HEIGHT - 4} fontSize={8} textAnchor="middle"
                  fill="white" fontWeight="700">
                  HOY
                </text>
              </>
            )}

            {/* ── Task bars ── */}
            {tasksWithDate.map((task, rowIdx) => {
              const y       = HEADER_HEIGHT + rowIdx * ROW_HEIGHT
              const dueIdx  = Math.floor(
                (startOfDay(new Date(task.dueDate!)).getTime() - rangeStart.getTime()) / 86400000
              )
              const barX    = dueIdx * DAY_WIDTH
              const color   = STATUS_COLORS[task.status] ?? '#6b7280'
              const isOver  = new Date(task.dueDate!) < today && task.status !== 'DONE'

              return (
                <g key={task.id} onClick={() => onTaskClick?.(task)}
                  style={{ cursor: 'pointer' }}>
                  {/* Row stripe */}
                  {rowIdx % 2 === 1 && (
                    <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT}
                      fill="rgba(255,255,255,0.014)" />
                  )}

                  {/* Deadline bar */}
                  <rect
                    x={barX + 2} y={y + 8}
                    width={DAY_WIDTH - 4} height={ROW_HEIGHT - 16}
                    rx={4}
                    fill={color} fillOpacity={0.85}
                  />

                  {/* Overdue ring */}
                  {isOver && (
                    <rect x={barX + 1} y={y + 7}
                      width={DAY_WIDTH - 2} height={ROW_HEIGHT - 14}
                      rx={5} fill="none"
                      stroke="#ef4444" strokeWidth={1.5} strokeOpacity={0.8}
                    />
                  )}

                  {/* Row separator */}
                  <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT}
                    stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-gray-800 bg-gray-900/80 text-xs text-gray-500">
        {Object.entries(STATUS_COLORS).map(([s, color]) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span>{STATUS_LABELS[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-4 border-t border-dashed border-violet-400/60" />
          <span>Hoy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm border border-red-500/70 bg-red-500/40" />
          <span>Vencida</span>
        </div>
      </div>
    </div>
  )
}
