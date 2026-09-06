'use client'

import { cn } from '@/lib/utils/cn'

export interface MemberPointsDatum {
  userId: string
  label: string
  points: number
  percentage: number
  color: string
}

interface MemberPointsChartProps {
  data: MemberPointsDatum[]
  /** Pozo del proyecto; si es > 0 se muestra la parte de cada quien. */
  pool?: number
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/**
 * Puntos por persona.
 *
 * Barras horizontales porque el eje categórico son nombres: en vertical se
 * cortan o se inclinan. Cada barra lleva su etiqueta al lado, así que la
 * identidad no depende del color y no hace falta leyenda.
 */
export function MemberPointsChart({ data, pool = 0 }: MemberPointsChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Todavía no hay puntos acreditados en este proyecto.
      </p>
    )
  }

  const max = Math.max(...data.map((d) => d.points), 1)

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.userId} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: d.color }}
                aria-hidden
              />
              <span className="text-sm text-gray-200 truncate">{d.label}</span>
            </span>
            {/* El valor va en tinta de texto, no en el color de la serie. */}
            <span className="text-sm text-gray-400 tabular-nums flex-shrink-0">
              <span className="font-semibold text-gray-100">{d.points}</span> pts ·{' '}
              {d.percentage}%
              {pool > 0 && (
                <span className="text-gray-600"> · {currency.format((pool * d.percentage) / 100)}</span>
              )}
            </span>
          </div>

          {/* Riel recesivo + barra anclada a la línea base, extremo redondeado. */}
          <div className="h-2.5 rounded-sm bg-gray-800/70 overflow-hidden">
            <div
              className={cn('h-full rounded-r-[4px] transition-[width] duration-500')}
              style={{
                width: `${Math.max((d.points / max) * 100, d.points > 0 ? 1.5 : 0)}%`,
                backgroundColor: d.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
