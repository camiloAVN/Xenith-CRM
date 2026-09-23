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
          <h1 className="text-2xl sm:text-3xl font-bold">Proyectos</h1>
          <p className="text-sm sm:text-base text-gray-400 mt-1">
            Gestiona tus proyectos y su progreso
          </p>
        </div>
        {canCreateProjects && (
          <Link href="/dashboard/proyectos/nuevo" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proyecto
            </Button>
          </Link>
        )}
      </div>

      <Card className="p-4 sm:p-6">
        <Card.Header>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Buscar proyectos..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              {/* En móvil los botones quedan solo con ícono para que el buscador respire */}
              <Button type="submit" variant="outline" className="shrink-0 px-3 sm:px-4" aria-label="Buscar">
                <Search className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">Buscar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 px-3 sm:px-4"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Filtros"
              >
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Filtros</span>
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
