import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import {
  FolderKanban,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard - XENITH',
  description: 'Panel de administración de XENITH',
}

function calcTrend(
  current: number,
  previous: number
): { value: number; isPositive: boolean } | undefined {
  if (current === 0 && previous === 0) return undefined
  if (previous === 0) return { value: 100, isPositive: true }
  const pct = ((current - previous) / previous) * 100
  return { value: Math.abs(Math.round(pct * 10) / 10), isPositive: pct >= 0 }
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  if (hours < 24) return `Hace ${hours}h`
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days}d`
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date)
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-violet-500' },
  PROSPECT:    { label: 'Prospecto',   color: 'bg-blue-500' },
  ON_HOLD:     { label: 'En Pausa',    color: 'bg-amber-500' },
  COMPLETED:   { label: 'Completados', color: 'bg-green-500' },
  CANCELLED:   { label: 'Cancelados',  color: 'bg-red-500' },
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (currentUser?.role !== 'SUPERADMIN') redirect('/dashboard/proyectos')

  const now = new Date()
  const thisMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    activeProjects,
    newProjectsThisMonth,
    newProjectsLastMonth,
    totalClients,
    newClientsThisMonth,
    newClientsLastMonth,
    quotationsThisMonth,
    quotationsLastMonth,
    earningsThisMonth,
    earningsLastMonth,
    projectsByStatus,
    completedProjects,
    cancelledProjects,
    completedWithDates,
    totalQuotations,
    acceptedQuotations,
    recentProjects,
    recentClients,
    recentQuotations,
  ] = await Promise.all([
    // Stat 1: active projects (IN_PROGRESS right now)
    prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
    // Trend: new projects created this month vs last month
    prisma.project.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.project.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),

    // Stat 2: total clients
    prisma.client.count(),
    prisma.client.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.client.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),

    // Stat 3: quotations
    prisma.quotation.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.quotation.count({ where: { createdAt: { gte: lastMonth, lt: thisMonth } } }),

    // Stat 4: company income this month from earnings table
    prisma.earning.aggregate({
      where: { type: 'COMPANY_INCOME', createdAt: { gte: thisMonth } },
      _sum: { amount: true },
    }),
    prisma.earning.aggregate({
      where: { type: 'COMPANY_INCOME', createdAt: { gte: lastMonth, lt: thisMonth } },
      _sum: { amount: true },
    }),

    // Projects grouped by status for bar chart
    prisma.project.groupBy({ by: ['status'], _count: { id: true } }),

    // Métricas adicionales
    prisma.project.count({ where: { status: 'COMPLETED' } }),
    prisma.project.count({ where: { status: 'CANCELLED' } }),
    prisma.project.findMany({
      where: { status: 'COMPLETED', startDate: { not: null }, endDate: { not: null } },
      select: { startDate: true, endDate: true },
    }),
    prisma.quotation.count(),
    prisma.quotation.count({ where: { status: 'ACCEPTED' } }),

    // Activity feed
    prisma.project.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, createdAt: true, client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, company: true, createdAt: true },
    }),
    prisma.quotation.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: {
        id: true, quotationNumber: true, status: true, createdAt: true,
        client: { select: { name: true } },
      },
    }),
  ])

  // --- Derived values ---
  const incomeNow  = Number(earningsThisMonth._sum.amount  ?? 0)
  const incomePrev = Number(earningsLastMonth._sum.amount  ?? 0)

  const successRate = completedProjects + cancelledProjects > 0
    ? Math.round((completedProjects / (completedProjects + cancelledProjects)) * 100)
    : null

  const avgMonths = completedWithDates.length > 0
    ? (() => {
        const totalMs = completedWithDates.reduce((acc, p) => {
          return acc + (new Date(p.endDate!).getTime() - new Date(p.startDate!).getTime())
        }, 0)
        return (totalMs / completedWithDates.length / (1000 * 60 * 60 * 24 * 30)).toFixed(1)
      })()
    : null

  const acceptanceRate = totalQuotations > 0
    ? Math.round((acceptedQuotations / totalQuotations) * 100)
    : null

  const totalProjects = projectsByStatus.reduce((acc, s) => acc + s._count.id, 0)
  const statusData = projectsByStatus
    .map((s) => ({
      label:      STATUS_CONFIG[s.status]?.label ?? s.status,
      color:      STATUS_CONFIG[s.status]?.color ?? 'bg-gray-500',
      value:      s._count.id,
      percentage: totalProjects > 0 ? Math.round((s._count.id / totalProjects) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // --- Activity feed (merged + sorted by createdAt) ---
  type ActivityItem = {
    id: string
    type: 'project' | 'client' | 'quotation'
    title: string
    description: string
    timestamp: string
    status?: 'success' | 'warning' | 'info'
    createdAt: Date
  }

  const allActivities: ActivityItem[] = [
    ...recentProjects.map((p) => ({
      id: `project-${p.id}`,
      type: 'project' as const,
      title: 'Proyecto creado',
      description: p.client ? `${p.title} — ${p.client.name}` : p.title,
      timestamp: formatRelative(p.createdAt),
      createdAt: p.createdAt,
      status: p.status === 'COMPLETED'
        ? 'success' as const
        : p.status === 'IN_PROGRESS' ? 'info' as const : 'warning' as const,
    })),
    ...recentClients.map((c) => ({
      id: `client-${c.id}`,
      type: 'client' as const,
      title: 'Nuevo cliente',
      description: c.company ? `${c.name} — ${c.company}` : c.name,
      timestamp: formatRelative(c.createdAt),
      createdAt: c.createdAt,
      status: 'success' as const,
    })),
    ...recentQuotations.map((q) => ({
      id: `quotation-${q.id}`,
      type: 'quotation' as const,
      title: `Cotización ${q.quotationNumber}`,
      description: q.client.name,
      timestamp: formatRelative(q.createdAt),
      createdAt: q.createdAt,
      status: q.status === 'ACCEPTED'
        ? 'success' as const
        : q.status === 'SENT' ? 'info' as const : 'warning' as const,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  // Strip createdAt before passing to component (not serializable as plain prop)
  const sortedActivities = allActivities.slice(0, 8).map(({ createdAt: _d, ...rest }) => rest)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Bienvenido al <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="text-gray-400">Resumen de tu actividad y métricas principales</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Proyectos Activos"
          value={activeProjects}
          icon={FolderKanban}
          trend={calcTrend(newProjectsThisMonth, newProjectsLastMonth)}
          iconColor="text-violet-400"
          iconBgColor="bg-violet-500/10"
        />
        <StatsCard
          title="Clientes Totales"
          value={totalClients}
          icon={Users}
          trend={calcTrend(newClientsThisMonth, newClientsLastMonth)}
          iconColor="text-blue-400"
          iconBgColor="bg-blue-500/10"
        />
        <StatsCard
          title="Cotizaciones este mes"
          value={quotationsThisMonth}
          icon={FileText}
          trend={calcTrend(quotationsThisMonth, quotationsLastMonth)}
          iconColor="text-amber-400"
          iconBgColor="bg-amber-500/10"
        />
        <StatsCard
          title="Ingresos del Mes"
          value={incomeNow > 0 ? formatCurrency(incomeNow) : '$0'}
          icon={DollarSign}
          trend={calcTrend(incomeNow, incomePrev)}
          iconColor="text-green-400"
          iconBgColor="bg-green-500/10"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity activities={sortedActivities} />

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Proyectos por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {totalProjects === 0 ? (
                <p className="text-sm text-gray-500">No hay proyectos registrados aún.</p>
              ) : (
                <div className="space-y-4">
                  {statusData.map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">{s.label}</span>
                        <span className="text-sm text-gray-400">
                          {s.value} proyecto{s.value !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color} transition-all duration-300`}
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <QuickActions />

          <Card variant="glass">
            <CardHeader>
              <CardTitle>Métricas Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Tasa de Éxito</p>
                    <p className="text-2xl font-bold text-green-400">
                      {successRate !== null ? `${successRate}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">proyectos completados</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Duración Promedio</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {avgMonths ? `${avgMonths}m` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">meses por proyecto</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">Cotizaciones Aceptadas</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {acceptanceRate !== null ? `${acceptanceRate}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {acceptedQuotations} de {totalQuotations} enviadas
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
