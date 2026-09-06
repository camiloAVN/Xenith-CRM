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
    <div className="overflow-x-auto">
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
              <td>
                {project.startDate
                  ? format(new Date(project.startDate), 'dd MMM yyyy', {
                      locale: es,
                    })
                  : '-'}
              </td>
              <td>
                <div className="flex items-center gap-2">
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
                      if (
                        confirm(
                          '¿Estás seguro de que deseas eliminar este proyecto?'
                        )
                      ) {
                        onDelete(project.id)
                      }
                    }}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
