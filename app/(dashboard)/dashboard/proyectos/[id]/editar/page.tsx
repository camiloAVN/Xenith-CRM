'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProjects } from '@/hooks/useProjects'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { Card } from '@/components/ui/Card'
import { ProjectFormData } from '@/lib/validations/project'
import { ArrowLeft } from 'lucide-react'

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { currentProject, isLoading, fetchProject, editProject } = useProjects()
  const [projectData, setProjectData] = useState<any>(null)

  useEffect(() => {
    const loadProject = async () => {
      const data = await fetchProject(id)
      setProjectData(data)
    }
    loadProject()
  }, [id, fetchProject])

  const handleSubmit = async (data: ProjectFormData) => {
    const updated = await editProject(id, data)
    if (updated) {
      router.push(`/dashboard/proyectos/${id}`)
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/proyectos/${id}`)
  }

  if (isLoading || !projectData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al proyecto
        </Link>
        <h1 className="text-3xl font-bold">Editar Proyecto</h1>
        <p className="text-gray-400 mt-1">
          Actualiza la información del proyecto
        </p>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">Información del Proyecto</h2>
        </Card.Header>
        <Card.Content>
          <ProjectForm
            project={projectData}
            initialMemberIds={
              (projectData?.members ?? [])
                .map((m: { userId: string }) => m.userId)
            }
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
