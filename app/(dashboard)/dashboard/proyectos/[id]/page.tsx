'use client'

import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Edit,
  LayoutGrid,
  List,
  BarChart2,
  PieChart,
  Plus,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { KanbanBoard } from '@/components/projects/KanbanBoard'
import { ListView } from '@/components/projects/ListView'
import { GanttView } from '@/components/projects/GanttView'
import { TaskFilters } from '@/components/projects/TaskFilters'
import { TaskDetailPanel } from '@/components/projects/TaskDetailPanel'
import { ProjectProgress } from '@/components/projects/ProjectProgress'
import { ContributionShare } from '@/components/projects/ContributionShare'
import { TaskCardData } from '@/components/projects/TaskCard'
import { statusLabels, statusColors, priorityLabels, priorityColors } from '@/lib/validations/project'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

type ViewMode = 'kanban' | 'list' | 'gantt'
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

interface ProjectData {
  id: string
  title: string
  description: string
  status: string
  priority: string
  startDate?: string | null
  endDate?: string | null
  client?: { id: string; name: string; company?: string | null }
  assignedUser?: { id: string; name?: string | null; email: string }
  members?: Array<{ user: { id: string; name?: string | null; email: string; image?: string | null } }>
  permissions?: ProjectPermissions
}

interface ProjectPermissions {
  isOwner: boolean
  isLead: boolean
  isMember: boolean
  canManageMembers: boolean
  canManageLeads: boolean
  canManageTasks: boolean
  canVote: boolean
  canEditSettings: boolean
}

interface ProgressData {
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

interface FilterState {
  search: string
  status: string[]
  priority: string[]
  assignedTo: string
  dueDateFrom: string
  dueDateTo: string
}

const EMPTY_KANBAN: Record<TaskStatus, TaskCardData[]> = {
  TODO: [],
  IN_PROGRESS: [],
  REVIEW: [],
  DONE: [],
  BLOCKED: [],
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session } = useSession()
  const { id } = use(params)

  const [project, setProject] = useState<ProjectData | null>(null)
  const [allUsers, setAllUsers] = useState<{ id: string; name?: string | null; email: string }[]>([])
  const [allTasks, setAllTasks] = useState<TaskCardData[]>([])
  const [kanbanBoard, setKanbanBoard] = useState<Record<TaskStatus, TaskCardData[]>>(EMPTY_KANBAN)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: [],
    priority: [],
    assignedTo: '',
    dueDateFrom: '',
    dueDateTo: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<TaskCardData | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('TODO')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  // Se incrementa en cada cambio de tarea para que el reparto se recalcule:
  // aceptar o reabrir una tarea mueve los porcentajes de todo el equipo.
  const [contributionsKey, setContributionsKey] = useState(0)

  // Fetch project and initial data
  const loadProject = useCallback(async () => {
    try {
      // forSelect=true: la ruta sin el flag exige SUPERADMIN, y sin la lista
      // de usuarios los desplegables de asignación de tareas quedan vacíos.
      const [projectRes, progressRes, usersRes] = await Promise.all([
        fetch(`/api/v1/projects/${id}`),
        fetch(`/api/v1/projects/${id}/progress`),
        fetch('/api/users?forSelect=true'),
      ])

      if (projectRes.ok) setProject(await projectRes.json())
      if (progressRes.ok) setProgress(await progressRes.json())
      if (usersRes.ok) setAllUsers(await usersRes.json())
    } catch (err) {
      console.error('Error loading project:', err)
    }
  }, [id])

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status.length) params.set('status', filters.status.join(','))
      if (filters.priority.length) params.set('priority', filters.priority.join(','))
      if (filters.assignedTo) params.set('assignedTo', filters.assignedTo)
      if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom)
      if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo)

      const [listRes, kanbanRes] = await Promise.all([
        fetch(`/api/v1/projects/${id}/tasks?${params}`),
        fetch(`/api/v1/projects/${id}/tasks?view=kanban`),
      ])

      if (listRes.ok) setAllTasks(await listRes.json())
      if (kanbanRes.ok) {
        const board = await kanbanRes.json()
        setKanbanBoard(board)
      }
    } catch (err) {
      console.error('Error loading tasks:', err)
    }
  }, [id, filters])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([loadProject(), loadTasks()])
      setIsLoading(false)
    }
    init()
  }, [loadProject, loadTasks])

  // Refresh progress after task changes
  const refreshProgress = useCallback(async () => {
    const res = await fetch(`/api/v1/projects/${id}/progress`)
    if (res.ok) setProgress(await res.json())
    setContributionsKey((k) => k + 1)
  }, [id])

  // Equipo asignable: miembros del proyecto + el líder (los proyectos viejos
  // pueden no tener fila en ProjectMember para el líder). El backend exige que
  // el asignado sea del equipo, así que la lista tiene que coincidir.
  const teamMembers = (() => {
    const map = new Map<string, { id: string; name?: string | null; email: string }>()
    for (const m of project?.members ?? []) map.set(m.user.id, m.user)
    if (project?.assignedUser) map.set(project.assignedUser.id, project.assignedUser)
    return [...map.values()]
  })()

  const canManageTasks = project?.permissions?.canManageTasks ?? false
  const canCreateTask =
    newTaskTitle.trim().length > 0 && newTaskAssignee !== '' && newTaskDueDate !== ''

  const handleTaskClick = (task: TaskCardData) => {
    setSelectedTask(task)
    setIsPanelOpen(true)
  }

  const handleTaskUpdated = useCallback(
    (updated: TaskCardData) => {
      setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
      setKanbanBoard((prev) => {
        const next = { ...prev }
        // Remove from all columns
        for (const col of Object.keys(next) as TaskStatus[]) {
          next[col] = next[col].filter((t) => t.id !== updated.id)
        }
        // Add to correct column
        const status = updated.status as TaskStatus
        next[status] = [{ ...updated }, ...next[status]]
        return next
      })
      setSelectedTask((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
      refreshProgress()
      loadTasks()
    },
    [refreshProgress, loadTasks]
  )

  const handleTaskDeleted = useCallback(
    (taskId: string) => {
      setAllTasks((prev) => prev.filter((t) => t.id !== taskId))
      setKanbanBoard((prev) => {
        const next = { ...prev }
        for (const col of Object.keys(next) as TaskStatus[]) {
          next[col] = next[col].filter((t) => t.id !== taskId)
        }
        return next
      })
      refreshProgress()
      loadTasks()
    },
    [refreshProgress, loadTasks]
  )

  const handleAddTask = (status: TaskStatus) => {
    setNewTaskStatus(status)
    setNewTaskTitle('')
    setNewTaskAssignee('')
    setNewTaskDueDate('')
    setShowNewTaskModal(true)
  }

  const handleCreateTask = async () => {
    if (!canCreateTask || isCreatingTask) return
    setIsCreatingTask(true)
    try {
      const res = await fetch(`/api/v1/projects/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: newTaskStatus,
          assignedTo: newTaskAssignee,
          dueDate: newTaskDueDate,
        }),
      })
      if (res.ok) {
        const task = await res.json()
        setAllTasks((prev) => [task, ...prev])
        setKanbanBoard((prev) => ({
          ...prev,
          [newTaskStatus]: [...prev[newTaskStatus], task],
        }))
        setShowNewTaskModal(false)
        setNewTaskTitle('')
        setNewTaskAssignee('')
        setNewTaskDueDate('')
        refreshProgress()
        // Reconciliar con el servidor: la respuesta de creacion no trae la
        // penalizacion calculada ni el orden definitivo de la columna.
        loadTasks()
        toast.success('Tarea creada — votación de puntos abierta')
      } else {
        // Un fallo silencioso aquí dejaba el modal abierto sin explicar nada.
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'No se pudo crear la tarea')
      }
    } finally {
      setIsCreatingTask(false)
    }
  }

  // Full user list for task assignment (all users in the system)
  const users = allUsers

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Proyecto no encontrado</p>
        <Link href="/dashboard/proyectos" className="text-violet-400 text-sm hover:underline mt-2 block">
          Volver a proyectos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ---- Header ---- */}
      <div>
        <Link
          href="/dashboard/proyectos"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Proyectos
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-100 truncate">{project.title}</h1>
              <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                {statusLabels[project.status as keyof typeof statusLabels]}
              </Badge>
              <Badge className={priorityColors[project.priority as keyof typeof priorityColors]}>
                {priorityLabels[project.priority as keyof typeof priorityLabels]}
              </Badge>
            </div>
            {project.client && (
              <p className="text-sm text-gray-500 mt-1">
                {project.client.name}
                {project.client.company && ` · ${project.client.company}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/dashboard/proyectos/${id}/aportes`}>
              <Button variant="outline" size="sm">
                <PieChart className="w-4 h-4 mr-1.5" />
                Aportes
              </Button>
            </Link>
            <Link href={`/dashboard/proyectos/${id}/editar`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
            </Link>
            {canManageTasks && (
              <Button
                size="sm"
                onClick={() => handleAddTask('TODO')}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nueva Tarea
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ---- Progress + View switcher row ---- */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Progress inline */}
        {progress && (
          <div className="flex items-center gap-3 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2">
            <div className="relative">
              <svg width={40} height={40} viewBox="0 0 40 40" className="-rotate-90">
                <circle cx={20} cy={20} r={14} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
                <circle
                  cx={20}
                  cy={20}
                  r={14}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={5}
                  strokeDasharray={`${(progress.percentage / 100) * 87.96} 87.96`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {progress.percentage}%
              </span>
            </div>
            <div className="text-xs text-gray-400">
              <span className="text-green-400 font-medium">{progress.done}</span> /{' '}
              <span className="font-medium text-gray-200">{progress.total}</span> tareas completadas
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {(
            [
              { mode: 'kanban' as ViewMode, icon: LayoutGrid, label: 'Kanban' },
              { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
              { mode: 'gantt' as ViewMode, icon: BarChart2, label: 'Gantt' },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === mode
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <Card className="py-3 px-4">
        <TaskFilters users={users} filters={filters} onChange={setFilters} />
      </Card>

      {/* ---- Aporte y reparto — común a las tres vistas ---- */}
      <ContributionShare projectId={id} refreshKey={contributionsKey} />

      {/* ---- Main view ---- */}
      <div className="min-w-0">
        {viewMode === 'kanban' && (
          <KanbanBoard
            projectId={id}
            initialTasks={kanbanBoard}
            onTaskClick={handleTaskClick}
            onAddTask={canManageTasks ? handleAddTask : undefined}
            onColumnsChange={setKanbanBoard}
          />
        )}

        {viewMode === 'list' && (
          <ListView tasks={allTasks} onTaskClick={handleTaskClick} />
        )}

        {viewMode === 'gantt' && (
          <GanttView
            tasks={allTasks}
            projectStart={project.startDate}
            projectEnd={project.endDate}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* ---- Task Detail Panel ---- */}
      <TaskDetailPanel
        task={selectedTask as never}
        projectId={id}
        users={users}
        currentUserId={session?.user?.id as string ?? ''}
        canManageTasks={canManageTasks}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false)
          setSelectedTask(null)
        }}
        onTaskUpdated={handleTaskUpdated as never}
        onTaskDeleted={handleTaskDeleted}
      />

      {/* ---- New Task Modal ---- */}
      {showNewTaskModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewTaskModal(false)}
          >
            <div
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100">Nueva Tarea</h3>
                <button
                  onClick={() => setShowNewTaskModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Título *</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowNewTaskModal(false)
                    }}
                    placeholder="¿Qué hay que hacer?"
                    autoFocus
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                {/* Asignado y fecha límite son obligatorios: sin asignado no
                    hay a quién acreditar los puntos y sin fecha límite no hay
                    penalización que calcular. */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Asignado a *</label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="">Selecciona a quién</option>
                    {teamMembers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1.5">
                      El proyecto no tiene miembros todavía.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Fecha límite *</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Estado inicial</label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: 'TODO', label: 'Por Hacer' },
                        { value: 'IN_PROGRESS', label: 'En Progreso' },
                        { value: 'REVIEW', label: 'En Revisión' },
                      ] as { value: TaskStatus; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setNewTaskStatus(opt.value)}
                        className={cn(
                          'px-3 py-1 text-xs rounded-md border transition-colors font-medium',
                          newTaskStatus === opt.value
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                Al crearla se abre la ventana de votación de puntos para el
                equipo. El trabajo puede empezar de una vez: la votación corre
                en paralelo.
              </p>

              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewTaskModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTask}
                  isLoading={isCreatingTask}
                  disabled={!canCreateTask}
                >
                  Crear Tarea
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
