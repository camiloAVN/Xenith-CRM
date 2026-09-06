'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { UserRole } from '@/lib/validations/user'

interface Permissions {
  role: UserRole | null
  /** Dueño del sistema: rol global SUPERADMIN. */
  isOwner: boolean
  /** Puede crear proyectos: el dueño, o quien tenga el permiso otorgado. */
  canCreateProjects: boolean
  isLoading: boolean
}

/**
 * Permisos globales del usuario en sesión.
 *
 * La sesión JWT solo lleva id/email/name/image — el rol no viaja ahí — así que
 * esto se resuelve contra /api/profile, que es la fuente de verdad del cliente.
 * Los permisos POR PROYECTO se resuelven en el servidor con
 * `getProjectPermissions` y llegan en la respuesta del proyecto.
 */
export function usePermissions(): Permissions {
  const { data: session, status } = useSession()
  const [permissions, setPermissions] = useState<Omit<Permissions, 'isLoading'>>({
    role: null,
    isOwner: false,
    canCreateProjects: false,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('No se pudo cargar el perfil')
        const data = await res.json()
        if (cancelled) return
        setPermissions({
          role: data.role ?? null,
          isOwner: data.role === 'SUPERADMIN',
          canCreateProjects: data.role === 'SUPERADMIN' || data.canCreateProjects === true,
        })
      } catch (error) {
        // Ante un fallo se asume el permiso mínimo: ocultar acciones es
        // preferible a mostrar botones que el servidor va a rechazar.
        console.error('Error al cargar permisos:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchProfile()

    return () => {
      cancelled = true
    }
  }, [session, status])

  return { ...permissions, isLoading }
}
