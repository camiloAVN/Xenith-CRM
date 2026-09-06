'use client'

import { useCallback, useEffect, useState } from 'react'
import { PieChart, UserMinus, Hourglass } from 'lucide-react'
import { buildColorMap } from '@/lib/utils/chart-palette'

interface MemberContribution {
  userId: string
  user: { id: string; name: string | null; email: string; image: string | null }
  points: number
  percentage: number
  share: number
  isCurrentMember: boolean
}

interface Contributions {
  totalPoints: number
  pool: number
  income: number
  deductions: number
  members: MemberContribution[]
  pendingPoints: number
  pendingTaskCount: number
}

interface ContributionShareProps {
  projectId: string
  /** Se incrementa desde el padre para forzar un refresco tras aceptar tareas. */
  refreshKey?: number
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

// La paleta vive en lib/utils/chart-palette: esta validada contra la superficie
// oscura (daltonismo incluido) y la comparte la ventana de graficos. La
// combinacion intuitiva violeta+azul de Tailwind que habia aqui era
// indistinguible en deuteranopia.

export function ContributionShare({ projectId, refreshKey = 0 }: ContributionShareProps) {
  const [data, setData] = useState<Contributions | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/contributions`)
      if (res.ok) setData(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-800 p-4">
        <div className="h-4 w-40 bg-gray-800 rounded animate-pulse" />
      </div>
    )
  }
  if (!data) return null

  const hasPoints = data.totalPoints > 0
  // El color sigue a la persona: reordenar el ranking no repinta a nadie.
  const colors = buildColorMap(data.members.map((m) => m.userId))
  const colorOf = (userId: string) => colors.get(userId) ?? '#3987e5'

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-900/60 border-b border-gray-800 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
          <PieChart className="w-4 h-4 text-violet-400" />
          Aporte y reparto
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {data.totalPoints} puntos repartidos
          {data.pool > 0 && ` · pozo ${currency.format(data.pool)}`}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {!hasPoints ? (
          <p className="text-sm text-gray-500">
            Todavía no hay puntos acreditados. Los porcentajes aparecen cuando
            se acepte la primera tarea.
          </p>
        ) : (
          <>
            {/* Barra apilada: la composición del proyecto de un vistazo. */}
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
              {data.members.map((m) => (
                <div
                  key={m.userId}
                  className="transition-all"
                  style={{ width: `${m.percentage}%`, backgroundColor: colorOf(m.userId) }}
                  title={`${m.user.name || m.user.email}: ${m.percentage}%`}
                />
              ))}
            </div>

            <div className="space-y-2.5">
              {data.members.map((m) => (
                <div key={m.userId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorOf(m.userId) }}
                      />
                      <span className="text-gray-200 truncate">
                        {m.user.name || m.user.email}
                      </span>
                      {!m.isCurrentMember && (
                        <span
                          className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0"
                          title="Ya no está en el proyecto. Su saldo quedó congelado."
                        >
                          <UserMinus className="w-3 h-3" />
                          salió
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 tabular-nums flex-shrink-0">
                      <span className="font-semibold text-gray-100">{m.percentage}%</span>
                      <span className="text-gray-600"> · {m.points} pts</span>
                    </span>
                  </div>

                  {data.pool > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs text-emerald-400 tabular-nums">
                        {currency.format(m.share)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {data.pendingTaskCount > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-800/70">
            <Hourglass className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
            {data.pendingPoints} puntos en {data.pendingTaskCount} tarea
            {data.pendingTaskCount === 1 ? '' : 's'} ya valorada
            {data.pendingTaskCount === 1 ? '' : 's'} pero sin aceptar. Todavía no
            cuentan en el reparto.
          </p>
        )}
      </div>
    </div>
  )
}
