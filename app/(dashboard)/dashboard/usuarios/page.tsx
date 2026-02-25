'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import {
  Plus,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  User,
  UserRole,
  roleLabels,
  roleColors,
  SUPERADMIN_EMAIL,
} from '@/lib/validations/user'

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as UserRole,
    position: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if current user is superadmin
  const isSuperAdmin = session?.user?.email === SUPERADMIN_EMAIL

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user || session.user.email !== SUPERADMIN_EMAIL) {
      router.push('/dashboard')
      return
    }

    fetchUsers()
  }, [session, status, router])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/users')

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/dashboard')
          return
        }
        throw new Error('Error al cargar usuarios')
      }

      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast.error('Error al cargar usuarios')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingUser
        ? `/api/users/${editingUser.id}`
        : '/api/users'

      const method = editingUser ? 'PUT' : 'POST'

      const body = editingUser
        ? {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            position: formData.position || null,
            ...(formData.password && { password: formData.password }),
          }
        : { ...formData, position: formData.position || null }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar usuario')
      }

      toast.success(
        editingUser ? 'Usuario actualizado' : 'Usuario creado exitosamente'
      )
      setShowModal(false)
      resetForm()
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar usuario')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`¿Deseas desactivar al usuario ${user.name || user.email}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al desactivar usuario')
      }

      toast.success('Usuario desactivado')
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message || 'Error al desactivar usuario')
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })

      if (!response.ok) {
        throw new Error('Error al actualizar usuario')
      }

      toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado')
      fetchUsers()
    } catch (error) {
      toast.error('Error al actualizar usuario')
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      role: user.role,
      position: user.position || '',
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      position: '',
    })
    setEditingUser(null)
  }

  const roleOptions = [
    { value: 'USER', label: 'Usuario' },
    { value: 'ADMIN', label: 'Administrador' },
  ]

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-gray-400 mt-1">
            Gestiona los usuarios del sistema
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <Card.Content>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Cargo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.email === SUPERADMIN_EMAIL && (
                            <Shield className="w-4 h-4 text-red-400" />
                          )}
                          {user.name || 'Sin nombre'}
                        </div>
                      </td>
                      <td className="text-gray-400">{user.email}</td>
                      <td className="text-gray-400">{user.position || '—'}</td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            roleColors[user.role]
                          }`}
                        >
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td>
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-400">
                            <UserCheck className="w-4 h-4" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <UserX className="w-4 h-4" />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="text-gray-400">
                        {format(new Date(user.createdAt), 'dd MMM yyyy', {
                          locale: es,
                        })}
                      </td>
                      <td>
                        {user.email !== SUPERADMIN_EMAIL && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                              title={user.isActive ? 'Desactivar' : 'Activar'}
                            >
                              {user.isActive ? (
                                <UserX className="w-4 h-4 text-amber-400" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-green-400" />
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="Nombre *"
                placeholder="Juan Perez"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />

              <Input
                label="Email *"
                type="email"
                placeholder="juan@ejemplo.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />

              <Input
                label={editingUser ? 'Nueva Contrasena (opcional)' : 'Contrasena *'}
                type="password"
                placeholder="********"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required={!editingUser}
                helperText="Minimo 8 caracteres, incluir mayuscula, minuscula y numero"
              />

              <Input
                label="Cargo"
                placeholder="Ej: Desarrollador, Diseñador..."
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
              />

              <Select
                label="Rol *"
                options={roleOptions}
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as UserRole })
                }
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  {editingUser ? 'Actualizar' : 'Crear Usuario'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
