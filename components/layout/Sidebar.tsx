'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  LogOut,
  ChevronLeft,
  UserCog,
  Shield,
  CircleUser,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { SUPERADMIN_EMAIL } from '@/lib/validations/user'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const isSuperAdmin = user?.email === SUPERADMIN_EMAIL

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Proyectos',
      href: '/dashboard/proyectos',
      icon: FolderKanban,
    },
    {
      name: 'Clientes',
      href: '/dashboard/clientes',
      icon: Users,
    },
    {
      name: 'Cotizaciones',
      href: '/dashboard/cotizaciones',
      icon: FileText,
    },
  ]

  // Items solo para superadmin
  const adminNavigation = [
    {
      name: 'Usuarios',
      href: '/dashboard/usuarios',
      icon: UserCog,
    },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 border-r border-gray-800 bg-gray-950 transition-transform duration-200 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-800">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">X</span>
              </div>
              <span className="text-lg font-bold text-gradient">XENITH</span>
            </Link>

            {/* Close button (mobile only) */}
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                          : 'text-gray-400 hover:text-white hover:bg-gray-900'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Admin Section - Solo visible para superadmin */}
            {isSuperAdmin && (
              <>
                <div className="mt-6 mb-2 px-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    Administracion
                  </p>
                </div>
                <ul className="space-y-1">
                  {adminNavigation.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                            active
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'text-gray-400 hover:text-white hover:bg-gray-900'
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </nav>

          {/* User Section */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isSuperAdmin
                  ? 'bg-gradient-to-br from-red-500 to-orange-500'
                  : 'bg-gradient-to-br from-violet-500 to-indigo-500'
              )}>
                <span className="text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate flex items-center gap-1">
                  {user?.name || 'Usuario'}
                  {isSuperAdmin && (
                    <Shield className="w-3 h-3 text-red-400" />
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/perfil"
              onClick={onClose}
              className="flex items-center gap-2 w-full px-2 py-2 mb-1 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-all duration-200"
            >
              <CircleUser className="w-4 h-4" />
              Mi Perfil
            </Link>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesion
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
