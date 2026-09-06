'use client'

import { useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface MonthlySeries {
  userId: string
  label: string
  color: string
  /** Puntos por mes, alineado con `months`. */
  values: number[]
}

interface MonthlyPointsChartProps {
  months: string[]
  series: MonthlySeries[]
  /** Total del proyecto por mes, alineado con `months`. */
  totals: number[]
}

/** 'YYYY-MM' → 'ene 26'. */
function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
  return `${label.replace('.', '')} ${String(y).slice(2)}`
}

/**
 * Puntos acreditados mes a mes, apilados por persona.
 *
 * Apilado y no agrupado porque interesan dos cosas a la vez: cuánto produjo el
 * proyecto ese mes (la altura total) y quién lo produjo (la composición).
 *
 * Un mes en cero se dibuja vacío en vez de desaparecer: dos meses sin acreditar
 * nada son justamente la señal que hay que ver.
 */
export function MonthlyPointsChart({ months, series, totals }: MonthlyPointsChartProps) {
  const [hover, setHover] = useState<{ month: number; series: number } | null>(null)
  const [showTable, setShowTable] = useState(false)

  if (months.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Aún no hay historial que graficar.
      </p>
    )
  }

  const max = Math.max(...totals, 1)
  // Cuatro líneas de referencia bastan para leer alturas sin ensuciar el fondo.
  const gridLines = [0.25, 0.5, 0.75, 1]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {showTable ? (
        // Vista de tabla: los datos exactos, y la ruta accesible cuando el
        // color no es legible (impresión, alto contraste, lector de pantalla).
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium py-2 pr-4">Persona</th>
                {months.map((m) => (
                  <th key={m} className="text-right font-medium py-2 px-2 whitespace-nowrap">
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="text-right font-medium py-2 pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.userId} className="border-t border-gray-800">
                  <td className="py-2 pr-4 text-gray-200 whitespace-nowrap">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-2"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    {s.label}
                  </td>
                  {s.values.map((v, i) => (
                    <td
                      key={i}
                      className={cn('py-2 px-2 text-right tabular-nums', v > 0 ? 'text-gray-300' : 'text-gray-700')}
                    >
                      {v > 0 ? v : '—'}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right tabular-nums font-semibold text-gray-100">
                    {s.values.reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-700">
                <td className="py-2 pr-4 text-gray-400 font-medium">Total del mes</td>
                {totals.map((t, i) => (
                  <td key={i} className="py-2 px-2 text-right tabular-nums text-gray-300">
                    {t > 0 ? t : '—'}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right tabular-nums font-semibold text-gray-100">
                  {totals.reduce((a, b) => a + b, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* Rejilla recesiva, detrás de las barras. */}
          <div className="absolute inset-x-0 top-0 h-48 pointer-events-none">
            {gridLines.map((g) => (
              <div
                key={g}
                className="absolute inset-x-0 border-t border-gray-800/60"
                style={{ bottom: `${g * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex items-end gap-1.5 h-48 overflow-x-auto pb-px">
            {months.map((month, mi) => {
              const total = totals[mi]
              return (
                <div
                  key={month}
                  className="flex-1 min-w-[28px] h-full flex flex-col justify-end"
                >
                  {/* column-reverse: las barras crecen desde la línea base. */}
                  <div className="flex flex-col-reverse w-full" style={{ height: `${(total / max) * 100}%` }}>
                    {series.map((s, si) => {
                      const value = s.values[mi]
                      if (value <= 0) return null
                      const isHovered = hover?.month === mi && hover?.series === si
                      const isTop =
                        si === [...series].map((x, i) => (x.values[mi] > 0 ? i : -1)).filter((i) => i >= 0).pop()

                      return (
                        <div
                          key={s.userId}
                          onMouseEnter={() => setHover({ month: mi, series: si })}
                          onMouseLeave={() => setHover(null)}
                          className={cn(
                            // 2px de separación entre segmentos para que se
                            // distingan sin depender solo del color.
                            'w-full transition-opacity cursor-default',
                            isTop && 'rounded-t-[4px]',
                            hover && !isHovered && 'opacity-40'
                          )}
                          style={{
                            height: `${(value / total) * 100}%`,
                            backgroundColor: s.color,
                            marginTop: 2,
                          }}
                          title={`${s.label} · ${formatMonth(month)}: ${value} pts`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Eje de meses */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto">
            {months.map((month, mi) => (
              <div
                key={month}
                className={cn(
                  'flex-1 min-w-[28px] text-center text-[10px] tabular-nums whitespace-nowrap',
                  hover?.month === mi ? 'text-gray-200' : 'text-gray-600'
                )}
              >
                {formatMonth(month)}
              </div>
            ))}
          </div>

          {/* Detalle del segmento señalado */}
          <div className="h-6 mt-2 text-xs text-gray-400">
            {hover ? (
              <span className="tabular-nums">
                <span
                  className="inline-block w-2 h-2 rounded-sm mr-1.5"
                  style={{ backgroundColor: series[hover.series].color }}
                  aria-hidden
                />
                {series[hover.series].label} · {formatMonth(months[hover.month])}:{' '}
                <span className="font-semibold text-gray-100">
                  {series[hover.series].values[hover.month]}
                </span>{' '}
                pts · total del mes {totals[hover.month]}
              </span>
            ) : (
              <span className="text-gray-600">Pasa el cursor sobre una barra para ver el detalle</span>
            )}
          </div>
        </div>
      )}

      {/* Leyenda: siempre presente con 2 o más series. */}
      {series.length >= 2 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {series.map((s) => (
            <span key={s.userId} className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
