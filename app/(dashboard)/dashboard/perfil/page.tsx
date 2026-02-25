'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { changePasswordSchema, ChangePasswordFormData, roleLabels, roleColors, UserRole, SUPERADMIN_EMAIL } from '@/lib/validations/user'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

type ProfileData = {
  id: string
  name: string | null
  email: string
  role: UserRole
  position: string | null
  createdAt: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => toast.error('Error al cargar perfil'))
      .finally(() => setIsLoadingProfile(false))
  }, [])

  const onSubmit = async (data: ChangePasswordFormData) => {
    setApiError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        setApiError(json.error || 'Error al cambiar contraseña')
        return
      }

      toast.success('Contraseña actualizada')
      reset()
    } catch {
      setApiError('Error al cambiar contraseña')
    }
  }

  const isSuperAdmin = profile?.email === SUPERADMIN_EMAIL

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <p className="text-gray-400 mt-1">Tu información de cuenta</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Card */}
        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold">Información de cuenta</h2>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3 ${
                isSuperAdmin
                  ? 'bg-gradient-to-br from-red-500 to-orange-500'
                  : 'bg-gradient-to-br from-violet-500 to-indigo-500'
              }`}>
                {profile?.name?.charAt(0).toUpperCase() ?? profile?.email.charAt(0).toUpperCase()}
              </div>
              <p className="text-xl font-semibold">{profile?.name || 'Sin nombre'}</p>
              {profile?.position && (
                <p className="text-sm text-gray-400 mt-0.5">{profile.position}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm text-gray-200">{profile?.email}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rol</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  roleColors[profile?.role ?? 'USER']
                }`}>
                  {roleLabels[profile?.role ?? 'USER']}
                </span>
              </div>

              {profile?.position && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cargo</p>
                  <p className="text-sm text-gray-200">{profile.position}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Miembro desde</p>
                <p className="text-sm text-gray-200">
                  {profile?.createdAt
                    ? format(new Date(profile.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })
                    : '—'}
                </p>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Change Password Card */}
        <Card>
          <Card.Content className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <KeyRound className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {apiError && (
                <Alert variant="error" title="Error">
                  {apiError}
                </Alert>
              )}

              <Input
                label="Contraseña actual"
                type={showCurrent ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.currentPassword?.message}
                rightIcon={
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="text-gray-400 hover:text-gray-200 transition-colors">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('currentPassword')}
              />

              <Input
                label="Nueva contraseña"
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.newPassword?.message}
                helperText="Mínimo 8 caracteres, incluir mayúscula, minúscula y número"
                rightIcon={
                  <button type="button" onClick={() => setShowNew(!showNew)} className="text-gray-400 hover:text-gray-200 transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('newPassword')}
              />

              <Input
                label="Confirmar nueva contraseña"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                rightIcon={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-200 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('confirmPassword')}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'Actualizando...' : 'Cambiar contraseña'}
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  )
}
