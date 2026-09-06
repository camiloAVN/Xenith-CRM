'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/hooks/useProjects'
import { usePermissions } from '@/hooks/usePermissions'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { Card } from '@/components/ui/Card'
import { ProjectFormData } from '@/lib/validations/project'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewProjectPage() {
  const router = useRouter()
  const { createProject, isLoading } = useProjects()
  const { canCreateProjects, isLoading: loadingPermissions } = usePermissions()

  // El servidor ya rechaza el POST; esto solo evita mostrar un formulario
  // que no se va a poder enviar.
  useEffect(() => {
    if (!loadingPermissions && !canCreateProjects) {
      router.replace('/dashboard/proyectos')
    }
  }, [loadingPermissions, canCreateProjects, router])

  const handleSubmit = async (data: ProjectFormData) => {
    const project = await createProject(data)
    if (project) {
      router.push('/dashboard/proyectos')
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/proyectos')
  }

  if (loadingPermissions || !canCreateProjects) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/proyectos"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a proyectos
        </Link>
        <h1 className="text-3xl font-bold">Nuevo Proyecto</h1>
        <p className="text-gray-400 mt-1">
          Crea un nuevo proyecto para tu cartera
        </p>
      </div>

      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">Información del Proyecto</h2>
        </Card.Header>
        <Card.Content>
          <ProjectForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isLoading}
          />
        </Card.Content>
      </Card>
    </div>
  )
}
