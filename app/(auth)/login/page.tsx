import { Metadata } from 'next'
import { Lock } from 'lucide-react'
import { LoginForm } from '@/components/forms/LoginForm'
import { Card } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Iniciar Sesión',
  description: 'Accede al panel de administración de XENITH',
}

export default function LoginPage() {
  return (
    <Card variant="glass" className="p-6 sm:p-8">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/50">
          <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          Bienvenido de <span className="text-gradient">Vuelta</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Ingresa tus credenciales para acceder al dashboard
        </p>
      </div>

      <LoginForm />

      <div className="mt-6 pt-6 border-t border-gray-800">
        <div className="flex items-start gap-3 text-xs text-gray-500">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Tu información está protegida con encriptación de nivel empresarial.
            Nunca compartiremos tus datos.
          </p>
        </div>
      </div>
    </Card>
  )
}
