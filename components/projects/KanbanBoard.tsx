'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard, TaskCardData } from './TaskCard'
import { cn } from '@/lib/utils/cn'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

const COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']

const COLUMN_META: Record<TaskStatus, { label: string; dot: string }> = {
  TODO:        { label: 'Por Hacer',   dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'En Progreso', dot: 'bg-blue-400' },
  REVIEW:      { label: 'En Revisión', dot: 'bg-yellow-400' },
  DONE:        { label: 'Hecho',       dot: 'bg-green-400' },
  BLOCKED:     { label: 'Bloqueado',   dot: 'bg-red-400' },
}

interface KanbanBoardProps {
  projectId: string
  initialTasks: Record<TaskStatus, TaskCardData[]>
  onTaskClick?: (task: TaskCardData) => void
  onAddTask?: (status: TaskStatus) => void
}

export function KanbanBoard({ projectId, initialTasks, onTaskClick, onAddTask }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Record<TaskStatus, TaskCardData[]>>(initialTasks)
  const [activeTask, setActiveTask] = useState<TaskCardData | null>(null)
  const [mobileCol, setMobileCol] = useState<TaskStatus>('TODO')
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Update scroll indicators
  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  const findColumn = useCallback(
    (taskId: string): TaskStatus | undefined => {
      for (const s of COLUMNS) {
        if (columns[s].some((t) => t.id === taskId)) return s
      }
    },
    [columns]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = event.active.id as string
      for (const s of COLUMNS) {
        const task = columns[s].find((t) => t.id === taskId)
        if (task) { setActiveTask(task); break }
      }
    },
    [columns]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return
      const activeId = active.id as string
      const overId = over.id as string
      const src = findColumn(activeId)
      const dst = COLUMNS.includes(overId as TaskStatus)
        ? (overId as TaskStatus)
        : findColumn(overId)
      if (!src || !dst || src === dst) return

      setColumns((prev) => {
        const srcTasks = [...prev[src]]
        const dstTasks = [...prev[dst]]
        const idx = srcTasks.findIndex((t) => t.id === activeId)
        const task = { ...srcTasks[idx], status: dst }
        srcTasks.splice(idx, 1)
        const overIdx = dstTasks.findIndex((t) => t.id === overId)
        if (overIdx >= 0) dstTasks.splice(overIdx, 0, task)
        else dstTasks.push(task)
        return { ...prev, [src]: srcTasks, [dst]: dstTasks }
      })
    },
    [findColumn]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string
      const src = findColumn(activeId)
      const dst = COLUMNS.includes(overId as TaskStatus)
        ? (overId as TaskStatus)
        : findColumn(overId)
      if (!src || !dst) return

      if (src === dst) {
        setColumns((prev) => {
          const tasks = [...prev[src]]
          const oldIdx = tasks.findIndex((t) => t.id === activeId)
          const newIdx = tasks.findIndex((t) => t.id === overId)
          if (oldIdx === newIdx) return prev
          return { ...prev, [src]: arrayMove(tasks, oldIdx, newIdx) }
        })
      }

      // Send reorder to API using the current state snapshot
      setColumns((prev) => {
        const payload = COLUMNS.flatMap((s) =>
          prev[s].map((task, idx) => ({ id: task.id, order: idx, status: s }))
        )
        fetch(`/api/v1/projects/${projectId}/tasks/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: payload }),
        }).catch(console.error)
        return prev
      })
    },
    [findColumn, projectId]
  )

  const totalTasks = COLUMNS.reduce((n, s) => n + columns[s].length, 0)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* ── MOBILE VIEW: column tabs + single active column ── */}
      <div className="md:hidden space-y-3">
        {/* Tab strip — scrollable horizontally */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {COLUMNS.map((s) => {
            const meta = COLUMN_META[s]
            const active = mobileCol === s
            return (
              <button
                key={s}
                onClick={() => setMobileCol(s)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  active
                    ? 'bg-gray-800 border-gray-600 text-gray-100 shadow'
                    : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                {meta.label}
                <span className="min-w-[16px] text-center px-1 rounded bg-gray-700/60 text-gray-400 font-mono">
                  {columns[s].length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Single column */}
        <KanbanColumn
          status={mobileCol}
          tasks={columns[mobileCol]}
          onTaskClick={onTaskClick}
          onAddTask={onAddTask}
          fullWidth
        />
      </div>

      {/* ── DESKTOP VIEW: horizontal scroll, bounded to parent ── */}
      <div className="hidden md:block relative">
        {/* Left fade + arrow */}
        <div
          className={cn(
            'absolute left-0 top-0 bottom-3 w-10 z-10 pointer-events-none',
            'bg-gradient-to-r from-gray-950 to-transparent transition-opacity duration-200',
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          )}
        />
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-1 top-6 z-20 p-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 shadow transition-all duration-200 hover:bg-gray-700',
            canScrollLeft ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right fade + arrow */}
        <div
          className={cn(
            'absolute right-0 top-0 bottom-3 w-10 z-10 pointer-events-none',
            'bg-gradient-to-l from-gray-950 to-transparent transition-opacity duration-200',
            canScrollRight ? 'opacity-100' : 'opacity-0'
          )}
        />
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-1 top-6 z-20 p-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 shadow transition-all duration-200 hover:bg-gray-700',
            canScrollRight ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scroll container — never overflows its parent */}
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-3"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#374151 transparent',
          } as React.CSSProperties}
        >
          <div className="flex gap-3 w-max">
            {COLUMNS.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                tasks={columns[s]}
                onTaskClick={onTaskClick}
                onAddTask={onAddTask}
              />
            ))}
          </div>
        </div>

        {/* Scroll hint — shown when there are tasks and board is wider than viewport */}
        {totalTasks === 0 && (
          <p className="text-center text-xs text-gray-600 py-8">
            No hay tareas. Usa el botón &quot;+&quot; en cualquier columna para crear una.
          </p>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
