'use client'

import Link from 'next/link'
import { Project, statusLabels, statusColors, priorityLabels, priorityColors } from '@/lib/validations/project'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Eye, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ProjectsTableProps {
  projects: Project[]
  onDelete: (id: string) => void
}

export function ProjectsTable({ projects, onDelete }: ProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No hay proyectos registrados</p>
        <p className="text-sm text-gray-500 mt-2">
          Crea tu primer proyecto para comenzar
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Móvil: una tarjeta por proyecto en vez de una tabla de 7 columnas */}
      <ul className="md:hidden space-y-3">
        {projects.map((project) => (
          <li
            key={project.id}
            className="rounded-lg border border-gray-800 bg-gray-900/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/dashboard/proyectos/${project.id}`}
                className="min-w-0 flex-1"
              >
                <p className="font-medium break-words">{project.title}</p>
                <p className="text-sm text-gray-500 truncate">
                  {project.client
                    ? [project.client.name, project.client.company].filter(Boolean).join(' · ')
                    : 'Sin cliente'}
                </p>
              </Link>
              <ProjectActions project={project} onDelete={onDelete} />
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={statusColors[project.status]}>
                {statusLabels[project.status]}
              </Badge>
              <Badge className={priorityColors[project.priority]}>
                {priorityLabels[project.priority]}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3 text-xs text-gray-400">
              <span className="truncate">
                {project.assignedUser?.name || project.assignedUser?.email}
              </span>
              <span className="shrink-0">{formatStart(project.startDate)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Asignado a</th>
              <th>Fecha Inicio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="font-medium">{project.title}</td>
                <td>
                  {project.client ? (
                    <>
                      {project.client.name}
                      {project.client.company && (
                        <span className="text-sm text-gray-500 block">
                          {project.client.company}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-600">Sin cliente</span>
                  )}
                </td>
                <td>
                  <Badge className={statusColors[project.status]}>
                    {statusLabels[project.status]}
                  </Badge>
                </td>
                <td>
                  <Badge className={priorityColors[project.priority]}>
                    {priorityLabels[project.priority]}
                  </Badge>
                </td>
                <td>{project.assignedUser?.name || project.assignedUser?.email}</td>
                <td>{formatStart(project.startDate)}</td>
                <td>
                  <ProjectActions project={project} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}

function formatStart(startDate: Project['startDate']) {
  return startDate ? format(new Date(startDate), 'dd MMM yyyy', { locale: es }) : '-'
}

function ProjectActions({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <Link href={`/dashboard/proyectos/${project.id}`}>
        <Button variant="ghost" size="sm" title="Ver detalles">
          <Eye className="w-4 h-4" />
        </Button>
      </Link>
      <Link href={`/dashboard/proyectos/${project.id}/editar`}>
        <Button variant="ghost" size="sm" title="Editar">
          <Edit className="w-4 h-4" />
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        onClick={() => {
          if (confirm('¿Estás seguro de que deseas eliminar este proyecto?')) {
            onDelete(project.id)
          }
        }}
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
