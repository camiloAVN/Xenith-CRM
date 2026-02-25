'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Trash2, ChevronDown, Clock, History } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TaskComments } from './TaskComments'
import { TaskHistory } from './TaskHistory'

interface User {
  id: string
  name?: string | null
  email: string
  image?: string | null
}

interface TaskDetail {
  id: string
  title: string
  description?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assignedTo?: string | null
  reporterId?: string | null
  dueDate?: string | Date | null
  estimatedHours?: number | null
  actualHours?: number | null
  tags?: string[]
  assignedUser?: User | null
  reporter?: User | null
  comments?: Array<{
    id: string
    content: string
    createdAt: string | Date
    updatedAt: string | Date
    user: User
  }>
  history?: Array<{
    id: string
    field: string
    oldValue?: string | null
    newValue?: string | null
    createdAt: string | Date
    user: User
  }>
}

interface TaskDetailPanelProps {
  task: TaskDetail | null
  projectId: string
  users?: User[]
  currentUserId: string
  isOpen: boolean
  onClose: () => void
  onTaskUpdated?: (task: TaskDetail) => void
  onTaskDeleted?: (taskId: string) => void
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'Por Hacer' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'REVIEW', label: 'En Revisión' },
  { value: 'DONE', label: 'Hecho' },
  { value: 'BLOCKED', label: 'Bloqueado' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

const priorityColors = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-blue-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
}

type Tab = 'comments' | 'history'

function SelectField({
  label,
  value,
  options,
  onChange,
  colorClass,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  colorClass?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500 pr-8 transition-colors',
            colorClass ?? 'text-gray-200'
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>
    </div>
  )
}

export function TaskDetailPanel({
  task,
  projectId,
  users = [],
  currentUserId,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailPanelProps) {
  const [fullTask, setFullTask] = useState<TaskDetail | null>(task)
  const [isLoadingFull, setIsLoadingFull] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('comments')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')

  const taskUrl = task ? `/api/v1/projects/${projectId}/tasks/${task.id}` : null

  // Load full task data (with comments + history)
  const loadFullTask = useCallback(async () => {
    if (!task) return
    setIsLoadingFull(true)
    try {
      const res = await fetch(taskUrl!)
      if (res.ok) {
        const data = await res.json()
        setFullTask(data)
        setTitleDraft(data.title)
        setDescDraft(data.description ?? '')
      }
    } finally {
      setIsLoadingFull(false)
    }
  }, [task, taskUrl])

  useEffect(() => {
    if (isOpen && task) {
      setFullTask(task)
      setTitleDraft(task.title)
      setDescDraft(task.description ?? '')
      loadFullTask()
    }
  }, [isOpen, task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = async (field: string, value: unknown) => {
    if (!task || isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch(taskUrl!, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFullTask((prev) => ({ ...prev!, ...updated }))
        onTaskUpdated?.({ ...fullTask!, ...updated })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleSave = async () => {
    if (titleDraft.trim() && titleDraft !== fullTask?.title) {
      await updateField('title', titleDraft.trim())
    }
    setEditingTitle(false)
  }

  const handleDescSave = async () => {
    if (descDraft !== fullTask?.description) {
      await updateField('description', descDraft || null)
    }
  }

  const handleDelete = async () => {
    if (!task || !confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(taskUrl!, { method: 'DELETE' })
      if (res.ok) {
        onTaskDeleted?.(task.id)
        onClose()
      }
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }

  if (!isOpen) return null

  const ft = fullTask

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-[480px] max-w-[95vw] z-50 bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tarea</span>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-gray-500 animate-pulse">Guardando...</span>
            )}
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
              title="Eliminar tarea"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoadingFull && !ft ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ft ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Title (inline edit) */}
              <div>
                {editingTitle ? (
                  <textarea
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleTitleSave()
                      }
                      if (e.key === 'Escape') {
                        setTitleDraft(ft.title)
                        setEditingTitle(false)
                      }
                    }}
                    className="w-full bg-transparent text-xl font-semibold text-gray-100 resize-none focus:outline-none border-b border-violet-500 pb-1"
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-xl font-semibold text-gray-100 cursor-text hover:text-white transition-colors leading-snug"
                    onClick={() => {
                      setTitleDraft(ft.title)
                      setEditingTitle(true)
                    }}
                  >
                    {ft.title}
                  </h2>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Descripción</label>
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={handleDescSave}
                  placeholder="Agrega una descripción..."
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-none transition-colors"
                  rows={3}
                />
              </div>

              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Estado"
                  value={ft.status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => {
                    setFullTask((p) => ({ ...p!, status: v as TaskDetail['status'] }))
                    updateField('status', v)
                  }}
                />
                <SelectField
                  label="Prioridad"
                  value={ft.priority}
                  options={PRIORITY_OPTIONS}
                  onChange={(v) => {
                    setFullTask((p) => ({ ...p!, priority: v as TaskDetail['priority'] }))
                    updateField('priority', v)
                  }}
                  colorClass={priorityColors[ft.priority]}
                />

                {/* Assignee */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Asignado a</label>
                  <div className="relative">
                    <select
                      value={ft.assignedTo ?? ''}
                      onChange={(e) => updateField('assignedTo', e.target.value || null)}
                      className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500 pr-8 transition-colors"
                    >
                      <option value="">Sin asignar</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Reporter */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Reportado por</label>
                  <p className="text-sm text-gray-300 py-1.5">
                    {ft.reporter?.name ?? ft.reporter?.email ?? '—'}
                  </p>
                </div>

                {/* Due date */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={ft.dueDate ? new Date(ft.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateField('dueDate', e.target.value || null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                {/* Estimated hours */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Horas Estimadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ft.estimatedHours ?? ''}
                    onChange={(e) =>
                      updateField('estimatedHours', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="0"
                  />
                </div>

                {/* Actual hours */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Horas Reales
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ft.actualHours ?? ''}
                    onChange={(e) =>
                      updateField('actualHours', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tags */}
              {ft.tags && ft.tags.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ft.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs: Comments / History */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex gap-1 mb-4">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                      activeTab === 'comments'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    Comentarios
                    {ft.comments && ft.comments.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 font-mono text-xs">
                        {ft.comments.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                      activeTab === 'history'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    )}
                  >
                    <History className="w-3 h-3" />
                    Historial
                    {ft.history && ft.history.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 font-mono text-xs">
                        {ft.history.length}
                      </span>
                    )}
                  </button>
                </div>

                {activeTab === 'comments' && (
                  <TaskComments
                    taskId={ft.id}
                    projectId={projectId}
                    comments={ft.comments ?? []}
                    currentUserId={currentUserId}
                    onCommentAdded={(comment) =>
                      setFullTask((prev) => prev ? { ...prev, comments: [...(prev.comments ?? []), comment] } : prev)
                    }
                    onCommentUpdated={(updated) =>
                      setFullTask((prev) =>
                        prev
                          ? {
                              ...prev,
                              comments: (prev.comments ?? []).map((c) => (c.id === updated.id ? updated : c)),
                            }
                          : prev
                      )
                    }
                    onCommentDeleted={(id) =>
                      setFullTask((prev) =>
                        prev
                          ? { ...prev, comments: (prev.comments ?? []).filter((c) => c.id !== id) }
                          : prev
                      )
                    }
                  />
                )}

                {activeTab === 'history' && (
                  <TaskHistory history={ft.history ?? []} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
