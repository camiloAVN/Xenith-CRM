'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, PieChart, Trophy, TrendingDown, Coins } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MemberPointsChart } from '@/components/charts/MemberPointsChart'
import { MonthlyPointsChart } from '@/components/charts/MonthlyPointsChart'
import { MemberTrendCard, type MemberTrendData } from '@/components/charts/MemberTrendCard'
import { buildColorMap } from '@/lib/utils/chart-palette'

interface Metrics {
  months: string[]
  totalPoints: number
  projectMonthly: number[]
  bestMonth: { month: string; points: number } | null
  members: Array<{
    userId: string
    user: { id: string; name: string | null; email: string }
    totalPoints: number
    percentage: number
    monthly: number[]
    bestMonth: { month: string; points: number } | null
    activeMonthAvg: number
    acceptedTasks: number
    trend: MemberTrendData['trend']
  }>
}

interface Contributions {
  pool: number
  income: number
  deductions: number
  pendingPoints: number
  pendingTaskCount: number
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
  return `${label} ${y}`
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export default function ProjectContributionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [contributions, setContributions] = useState<Contributions | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [metricsRes, contribRes, projectRes] = await Promise.all([
        fetch(`/api/v1/projects/${id}/contributions/metrics`),
        fetch(`/api/v1/projects/${id}/contributions`),
        fetch(`/api/v1/projects/${id}`),
      ])

      if (metricsRes.status === 403) {
        setError('No perteneces a este proyecto.')
        return
      }
      if (metricsRes.ok) setMetrics(await metricsRes.json())
      if (contribRes.ok) setContributions(await contribRes.json())
      if (projectRes.ok) setProjectTitle((await projectRes.json()).title ?? '')
    } catch (err) {
      console.error('Error cargando métricas:', err)
      setError('No se pudieron cargar las métricas.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al proyecto
        </Link>
        <p className="text-gray-400">{error}</p>
      </div>
    )
  }

  // El color sigue a la persona, no a su puesto: se fija por id ordenado, así
  // reordenar el ranking no repinta a nadie.
  const colors = buildColorMap(metrics?.members.map((m) => m.userId) ?? [])
  const nameOf = (m: Metrics['members'][number]) => m.user.name || m.user.email

  const barData =
    metrics?.members.map((m) => ({
      userId: m.userId,
      label: nameOf(m),
      points: m.totalPoints,
      percentage: m.percentage,
      color: colors.get(m.userId) ?? '#3987e5',
    })) ?? []

  const series =
    metrics?.members.map((m) => ({
      userId: m.userId,
      label: nameOf(m),
      color: colors.get(m.userId) ?? '#3987e5',
      values: m.monthly,
    })) ?? []

  const declining = metrics?.members.filter((m) => m.trend.direction === 'down') ?? []
  const hasData = (metrics?.totalPoints ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* ── Encabezado ─────────────────────────────────────────────────── */}
      <div>
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al proyecto
        </Link>
        <h1 className="text-3xl font-bold text-gray-100">Aportes y rendimiento</h1>
        <p className="text-gray-400 mt-1">
          {projectTitle || 'Proyecto'} · puntos acreditados, reparto e historial del equipo
        </p>
      </div>

      {/* ── Cifras de cabecera ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <PieChart className="w-3.5 h-3.5 text-violet-400" />
            Puntos repartidos
          </p>
          <p className="text-2xl font-semibold text-gray-100 tabular-nums">
            {metrics?.totalPoints ?? 0}
          </p>
          {(contributions?.pendingTaskCount ?? 0) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              + {contributions?.pendingPoints} sin aceptar todavía
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            Pozo repartible
          </p>
          <p className="text-2xl font-semibold text-gray-100 tabular-nums">
            {currency.format(contributions?.pool ?? 0)}
          </p>
          {(contributions?.deductions ?? 0) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {currency.format(contributions?.income ?? 0)} menos{' '}
              {currency.format(contributions?.deductions ?? 0)} en deducciones
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Mes más productivo
          </p>
          <p className="text-2xl font-semibold text-gray-100">
            {metrics?.bestMonth ? formatMonth(metrics.bestMonth.month) : '—'}
          </p>
          {metrics?.bestMonth && (
            <p className="text-xs text-gray-500 mt-1">
              {metrics.bestMonth.points} puntos acreditados
            </p>
          )}
        </div>
      </div>

      {!hasData ? (
        <Card>
          <Card.Content>
            <p className="text-sm text-gray-500 py-8 text-center">
              Este proyecto todavía no tiene puntos acreditados. Los gráficos
              aparecen cuando se acepte la primera tarea.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* ── Aviso de rendimiento a la baja ──────────────────────────── */}
          {declining.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <TrendingDown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200 leading-relaxed">
                <span className="font-medium">
                  {declining.map((m) => nameOf(m)).join(', ')}
                </span>{' '}
                {declining.length === 1 ? 'bajó' : 'bajaron'} el ritmo respecto al
                trimestre anterior. Es una señal para conversar, no un veredicto:
                un trimestre flojo puede ser vacaciones, tareas más grandes o
                trabajo que todavía no se ha aceptado.
              </p>
            </div>
          )}

          {/* ── Puntos por persona ──────────────────────────────────────── */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-100">Puntos por persona</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Total acreditado en el ledger del proyecto y su equivalente en el reparto.
              </p>
            </Card.Header>
            <Card.Content>
              <MemberPointsChart data={barData} pool={contributions?.pool ?? 0} />
            </Card.Content>
          </Card>

          {/* ── Historial mensual ───────────────────────────────────────── */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-100">Historial mensual</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Puntos acreditados mes a mes. La altura es la producción del
                proyecto; los colores, quién la aportó.
              </p>
            </Card.Header>
            <Card.Content>
              <MonthlyPointsChart
                months={metrics?.months ?? []}
                series={series}
                totals={metrics?.projectMonthly ?? []}
              />
            </Card.Content>
          </Card>

          {/* ── Rendimiento individual ──────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-1">
              Rendimiento individual
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Mejor mes de cada quien y comparación de los últimos 3 meses contra
              los 3 anteriores.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {metrics?.members.map((m) => (
                <MemberTrendCard
                  key={m.userId}
                  data={{
                    userId: m.userId,
                    label: nameOf(m),
                    color: colors.get(m.userId) ?? '#3987e5',
                    totalPoints: m.totalPoints,
                    percentage: m.percentage,
                    monthly: m.monthly,
                    months: metrics.months,
                    bestMonth: m.bestMonth,
                    activeMonthAvg: m.activeMonthAvg,
                    acceptedTasks: m.acceptedTasks,
                    trend: m.trend,
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
