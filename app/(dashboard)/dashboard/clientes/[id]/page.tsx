'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building2, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { currentClient, isLoading, fetchClient, deleteClient } = useClients()
  const [clientData, setClientData] = useState<any>(null)

  useEffect(() => {
    const loadClient = async () => {
      const data = await fetchClient(id)
      setClientData(data)
    }
    loadClient()
  }, [id, fetchClient])

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
      const success = await deleteClient(id)
      if (success) {
        router.push('/dashboard/clientes')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!clientData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Cliente no encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clientes"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a clientes
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{clientData.name}</h1>
            {clientData.company && (
              <p className="text-gray-400 mt-1">{clientData.company}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/clientes/${id}/editar`}>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
            <Button
              variant="outline"
              className="text-red-400 hover:text-red-300 hover:border-red-500/50"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Información de Contacto</h2>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-violet-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="font-medium">{clientData.email}</p>
                  </div>
                </div>

                {clientData.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Teléfono</p>
                      <p className="font-medium">{clientData.phone}</p>
                    </div>
                  </div>
                )}

                {clientData.company && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Empresa</p>
                      <p className="font-medium">{clientData.company}</p>
                    </div>
                  </div>
                )}

                {clientData.taxId && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">NIT</p>
                      <p className="font-medium">{clientData.taxId}</p>
                    </div>
                  </div>
                )}

                {(clientData.address || clientData.city || clientData.country) && (
                  <div className="flex items-start gap-3 md:col-span-2">
                    <MapPin className="w-5 h-5 text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Dirección</p>
                      <p className="font-medium">
                        {[clientData.address, clientData.city, clientData.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {clientData.notes && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <p className="text-sm text-gray-400 mb-2">Notas</p>
                  <p className="text-gray-300">{clientData.notes}</p>
                </div>
              )}
            </Card.Content>
          </Card>

          {clientData.projects && clientData.projects.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-xl font-semibold">Proyectos</h2>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {clientData.projects.map((project: any) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{project.title}</p>
                        <p className="text-sm text-gray-400">{project.status}</p>
                      </div>
                      <Link href={`/dashboard/proyectos/${project.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver detalles
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold">Información</h2>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Fecha de Registro</p>
                  <p className="font-medium">
                    {format(new Date(clientData.createdAt), 'dd MMMM yyyy', {
                      locale: es,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Última Actualización</p>
                  <p className="font-medium">
                    {format(new Date(clientData.updatedAt), 'dd MMMM yyyy', {
                      locale: es,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Proyectos</p>
                  <p className="font-medium">
                    {clientData.projects?.length || 0} proyectos
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Cotizaciones</p>
                  <p className="font-medium">
                    {clientData.quotations?.length || 0} cotizaciones
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  )
}
