'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectSchema, ProjectFormData, Project, statusLabels, priorityLabels } from '@/lib/validations/project'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { format } from 'date-fns'
import { X, Users, UserPlus } from 'lucide-react'

interface UserOption {
  id: string
  name: string | null
  email: string
}

interface ProjectFormProps {
  project?: Project | null
  initialMemberIds?: string[]
  onSubmit: (data: ProjectFormData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function ProjectForm({
  project,
  initialMemberIds = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProjectFormProps) {
  const [clients, setClients] = useState<{ id: string; name: string; company?: string | null }[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [memberIds, setMemberIds] = useState<string[]>(initialMemberIds)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: project
      ? {
          title: project.title,
          description: project.description,
          clientId: project.clientId,
          assignedTo: project.assignedTo,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
          endDate: project.endDate ? format(new Date(project.endDate), 'yyyy-MM-dd') : '',
          budget: project.budget?.toString() || '',
          notes: project.notes || '',
        }
      : {
          status: 'PROSPECT',
          priority: 'MEDIUM',
        },
  })

  // Observar el líder seleccionado para mostrarlo como fijo en el equipo
  const assignedTo = useWatch({ control, name: 'assignedTo' })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, usersRes] = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/users'),
        ])
        if (clientsRes.ok) setClients(await clientsRes.json())
        if (usersRes.ok) setUsers(await usersRes.json())
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [])

  const toggleMember = (userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const internalSubmit = async (data: ProjectFormData) => {
    await onSubmit({ ...data, memberIds })
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
  const priorityOptions = Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))
  const clientOptions = [
    { value: '', label: 'Selecciona un cliente' },
    ...clients.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` - ${c.company}` : ''}` })),
  ]
  const userOptions = [
    { value: '', label: 'Selecciona un usuario' },
    ...users.map((u) => ({ value: u.id, label: u.name || u.email })),
  ]

  const leader = users.find((u) => u.id === assignedTo)
  // Usuarios disponibles para agregar al equipo (excluye al líder)
  const availableUsers = users.filter((u) => u.id !== assignedTo)
  const selectedMembers = users.filter((u) => memberIds.includes(u.id) && u.id !== assignedTo)

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <Input
            label="Título del Proyecto *"
            placeholder="Desarrollo de aplicación web"
            error={errors.title?.message}
            {...register('title')}
          />
        </div>

        <div className="md:col-span-2">
          <Textarea
            label="Descripción *"
            placeholder="Describe los detalles del proyecto..."
            rows={4}
            error={errors.description?.message}
            {...register('description')}
          />
        </div>

        <Select
          label="Cliente *"
          options={clientOptions}
          error={errors.clientId?.message}
          {...register('clientId')}
        />

        <Select
          label="Líder del Proyecto *"
          options={userOptions}
          error={errors.assignedTo?.message}
          {...register('assignedTo')}
        />

        <Select
          label="Estado *"
          options={statusOptions}
          error={errors.status?.message}
          {...register('status')}
        />

        <Select
          label="Prioridad *"
          options={priorityOptions}
          error={errors.priority?.message}
          {...register('priority')}
        />

        <Input
          label="Fecha de Inicio"
          type="date"
          error={errors.startDate?.message}
          {...register('startDate')}
        />

        <Input
          label="Fecha de Fin"
          type="date"
          error={errors.endDate?.message}
          {...register('endDate')}
        />

        <Input
          label="Presupuesto"
          type="number"
          step="0.01"
          placeholder="10000.00"
          error={errors.budget?.message}
          {...register('budget')}
        />
      </div>

      <Textarea
        label="Notas"
        placeholder="Notas adicionales sobre el proyecto..."
        rows={3}
        error={errors.notes?.message}
        {...register('notes')}
      />

      {/* ── Equipo del proyecto ──────────────────────────────────────────── */}
      <div className="border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-gray-200">Equipo del Proyecto</h3>
        </div>

        {/* Líder — fijo, no se puede quitar */}
        {leader && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-14 flex-shrink-0">Líder</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30">
              {leader.name || leader.email}
              <span className="text-violet-500/60 text-[10px]">PROJECT MANAGER</span>
            </span>
          </div>
        )}

        {/* Miembros seleccionados */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedMembers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-700/60 text-gray-200 border border-gray-600"
              >
                {u.name || u.email}
                <button
                  type="button"
                  onClick={() => toggleMember(u.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Picker de usuarios disponibles */}
        {availableUsers.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <UserPlus className="w-3 h-3" />
              Agregar miembros
            </p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableUsers.map((u) => {
                const isSelected = memberIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleMember(u.id)}
                    className={cn(
                      'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                      isSelected
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200'
                    )}
                  >
                    {isSelected && <span className="text-violet-400">✓</span>}
                    {u.name || u.email}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600">
          El líder se agrega automáticamente como Project Manager. Los demás miembros se agregan como Desarrolladores.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {project ? 'Actualizar Proyecto' : 'Crear Proyecto'}
        </Button>
      </div>
    </form>
  )
}
