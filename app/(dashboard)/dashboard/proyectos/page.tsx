'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProjects } from '@/hooks/useProjects'
import { usePermissions } from '@/hooks/usePermissions'
import { ProjectsTable } from '@/components/dashboard/ProjectsTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Plus, Search, Filter } from 'lucide-react'
import { statusLabels, priorityLabels, ProjectStatus, Priority } from '@/lib/validations/project'

export default function ProjectsPage() {
  const { projects, isLoading, searchQuery, filters, setSearchQuery, setFilters, fetchProjects, deleteProject } = useProjects()
  const { canCreateProjects } = usePermissions()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchProjects({ search: searchQuery, ...filters })
  }, [fetchProjects, searchQuery, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(localSearch)
  }

  const handleDelete = async (id: string) => {
    const success = await deleteProject(id)
    if (success) {
      fetchProjects({ search: searchQuery, ...filters })
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value || undefined,
    })
  }

  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    ...Object.entries(statusLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ]

  const priorityOptions = [
    { value: '', label: 'Todas las prioridades' },
    ...Object.entries(priorityLabels).map(([value, label]) => ({
      value,
      label,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-gray-400 mt-1">
            Gestiona tus proyectos y su progreso
          </p>
        </div>
        {canCreateProjects && (
          <Link href="/dashboard/proyectos/nuevo">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <Card.Header>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Buscar proyectos..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="outline">
                Buscar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <Select
                  label="Estado"
                  options={statusOptions}
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                />
                <Select
                  label="Prioridad"
                  options={priorityOptions}
                  value={filters.priority || ''}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                />
              </div>
            )}
          </form>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando proyectos...</p>
            </div>
          ) : (
            <ProjectsTable projects={projects} onDelete={handleDelete} />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
