'use client'

import { TrendingUp, TrendingDown, Minus, HelpCircle, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type TrendDirection = 'up' | 'down' | 'flat' | 'insufficient'

export interface MemberTrendData {
  userId: string
  label: string
  color: string
  totalPoints: number
  percentage: number
  monthly: number[]
  months: string[]
  bestMonth: { month: string; points: number } | null
  activeMonthAvg: number
  acceptedTasks: number
  trend: {
    recentAvg: number
    previousAvg: number
    changePct: number | null
    direction: TrendDirection
  }
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
  return `${label} ${y}`
}

const TREND_CONFIG: Record<
  TrendDirection,
  { icon: typeof TrendingUp; label: string; className: string }
> = {
  up: { icon: TrendingUp, label: 'Subiendo', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  down: { icon: TrendingDown, label: 'Bajando', className: 'text-red-400 bg-red-500/10 border-red-500/25' },
  flat: { icon: Minus, label: 'Estable', className: 'text-gray-400 bg-gray-500/10 border-gray-500/25' },
  insufficient: { icon: HelpCircle, label: 'Sin historial', className: 'text-gray-500 bg-gray-800/60 border-gray-700' },
}

/**
 * Ficha de rendimiento de una persona.
 *
 * La tendencia compara el promedio de los últimos 3 meses contra los 3
 * anteriores. Se marca "estable" mientras la variación sea menor al 10 %: sin
 * esa banda muerta, un mes con una tarea de más gritaría "subió el rendimiento".
 * Quien lleve menos de 6 meses desde su primer aporte sale como "sin historial":
 * no hay contra qué comparar y etiquetarlo sería inventar una señal.
 */
export function MemberTrendCard({ data }: { data: MemberTrendData }) {
  const trend = TREND_CONFIG[data.trend.direction]
  const TrendIcon = trend.icon
  const max = Math.max(...data.monthly, 1)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: data.color }}
            aria-hidden
          />
          <span className="text-sm font-medium text-gray-100 truncate">{data.label}</span>
        </span>

        {/* Icono + texto: el estado nunca se comunica solo con color. */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium flex-shrink-0',
            trend.className
          )}
        >
          <TrendIcon className="w-3 h-3" />
          {trend.label}
          {data.trend.changePct != null && (
            <span className="tabular-nums">
              {data.trend.changePct > 0 ? '+' : ''}
              {data.trend.changePct}%
            </span>
          )}
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-gray-100 tabular-nums">
          {data.totalPoints}
        </span>
        <span className="text-xs text-gray-500">
          puntos · {data.percentage}% del proyecto · {data.acceptedTasks} tarea
          {data.acceptedTasks === 1 ? '' : 's'}
        </span>
      </div>

      {/* Sparkline: la forma del historial, no sus valores exactos. */}
      <div className="flex items-end gap-[2px] h-8" aria-hidden>
        {data.monthly.map((v, i) => (
          <div
            key={i}
            className="flex-1 min-w-[3px] rounded-t-[2px]"
            style={{
              height: `${Math.max((v / max) * 100, v > 0 ? 8 : 2)}%`,
              backgroundColor: v > 0 ? data.color : 'rgba(255,255,255,0.06)',
            }}
            title={`${data.months[i]}: ${v} pts`}
          />
        ))}
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            Mejor mes
          </dt>
          <dd className="text-gray-300 tabular-nums text-right">
            {data.bestMonth ? (
              <>
                {formatMonth(data.bestMonth.month)}{' '}
                <span className="text-gray-500">· {data.bestMonth.points} pts</span>
              </>
            ) : (
              <span className="text-gray-600">—</span>
            )}
          </dd>
        </div>

        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Promedio por mes activo</dt>
          <dd className="text-gray-300 tabular-nums">{data.activeMonthAvg} pts</dd>
        </div>

        {data.trend.direction !== 'insufficient' && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Últimos 3 meses vs. 3 previos</dt>
            <dd className="text-gray-300 tabular-nums">
              {data.trend.recentAvg} vs. {data.trend.previousAvg} pts/mes
            </dd>
          </div>
        )}
      </dl>

      {data.trend.direction === 'insufficient' && (
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Hacen falta 6 meses desde su primer aporte para comparar rendimiento.
        </p>
      )}
    </div>
  )
}
