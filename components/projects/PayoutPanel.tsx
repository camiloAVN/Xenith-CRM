'use client'

import { useCallback, useEffect, useState } from 'react'
import { Landmark, Banknote, Lock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'

interface Share {
  userId: string
  user: { id: string; name: string | null; email: string }
  points: number
  percentage: number
  amount: number
  capped: boolean
  total?: number
}

interface Preview {
  net: number
  income: number
  deductions: number
  distributed: number
  available: number
  company: number
  founder: number
  pool: number
  founderRatio: number
  poolRatio: number
  maxIndividualShare: number
  founderUserId: string | null
  totalPoints: number
  unassigned: number
  shares: Share[]
}

interface Payout {
  id: string
  description: string
  createdAt: string
  netAmount: number
  companyAmount: number
  founderAmount: number
  poolAmount: number
  founderUserId: string | null
  shares: Share[]
}

interface PayoutPanelProps {
  projectId: string
  /** Cambia cuando se acepta o revierte una tarea: el reparto se mueve. */
  refreshKey?: number
}

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

const firstName = (s: Share) => (s.user.name || s.user.email).split(' ')[0]

/**
 * Reparto del dinero: las tres capas y las liquidaciones ya congeladas.
 *
 * La foto de arriba es una simulación —lo que pasaría si se liquidara hoy lo
 * que falta— y cambia con cada tarea aceptada. Lo de abajo ya ocurrió y no se
 * vuelve a calcular nunca.
 */
export function PayoutPanel({ projectId, refreshKey = 0 }: PayoutPanelProps) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [canLiquidate, setCanLiquidate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLiquidating, setIsLiquidating] = useState(false)
  const [description, setDescription] = useState('')

  const url = `/api/v1/projects/${projectId}/payouts`

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setPreview(data.preview)
        setPayouts(data.payouts ?? [])
        setCanLiquidate(Boolean(data.canLiquidate))
      }
    } finally {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const liquidate = async () => {
    if (!preview || preview.available <= 0 || isLiquidating) return
    setIsLiquidating(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo liquidar')
        return
      }
      toast.success('Reparto congelado')
      setDescription('')
      await load()
    } finally {
      setIsLiquidating(false)
    }
  }

  if (isLoading) {
    return <div className="h-40 rounded-xl border border-gray-800 bg-gray-900/40 animate-pulse" />
  }
  if (!preview) return null

  const layers = [
    { key: 'empresa', label: 'Empresa', amount: preview.company, tone: 'bg-gray-600' },
    { key: 'fundador', label: 'Fundador', amount: preview.founder, tone: 'bg-amber-500' },
    { key: 'pozo', label: 'Pozo por puntos', amount: preview.pool, tone: 'bg-violet-500' },
  ]
  const base = preview.available > 0 ? preview.available : 1

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b border-gray-800">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
            <Landmark className="w-4 h-4 text-violet-400" />
            Reparto del dinero
          </span>
          <span className="text-xs text-gray-500 tabular-nums">
            Neto {money(preview.net)}
            {preview.distributed > 0 && ` · ya repartido ${money(preview.distributed)}`}
          </span>
          <span className="ml-auto text-xs text-gray-400 tabular-nums">
            Sin repartir: <span className="text-gray-200 font-medium">{money(preview.available)}</span>
          </span>
        </div>

        {preview.available <= 0 ? (
          <p className="px-4 py-4 text-xs text-gray-500">
            No hay dinero sin repartir. Registra el ingreso del proyecto en Ganancias y aquí
            aparecerá cómo se reparte.
          </p>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {/* Las tres capas, a escala sobre lo que falta por repartir */}
            <div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800">
                {layers.map((l) => (
                  <div
                    key={l.key}
                    className={cn('h-full', l.tone)}
                    style={{ width: `${Math.max(0, (l.amount / base) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-3">
                {layers.map((l) => (
                  <div key={l.key} className="flex items-baseline gap-2 text-xs">
                    <span className={cn('w-2 h-2 rounded-full flex-none', l.tone)} />
                    <span className="text-gray-400">{l.label}</span>
                    <span className="ml-auto text-gray-200 tabular-nums">{money(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quién recibe qué, si se liquidara hoy */}
            <div className="space-y-1.5">
              {preview.shares
                .filter((s) => s.points !== 0 || s.amount > 0)
                .map((s) => (
                  <div key={s.userId} className="flex items-baseline gap-2 text-xs">
                    <span className="text-gray-300">{firstName(s)}</span>
                    {s.userId === preview.founderUserId && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400">fundador</span>
                    )}
                    {s.capped && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        tope {Math.round(preview.maxIndividualShare * 100)} %
                      </span>
                    )}
                    <span className="text-gray-600 tabular-nums">
                      {s.points} pts · {s.percentage} %
                    </span>
                    <span className="ml-auto text-gray-200 tabular-nums">
                      {money(s.total ?? s.amount)}
                    </span>
                  </div>
                ))}
              {preview.totalPoints <= 0 && (
                <p className="text-xs text-gray-500">
                  Nadie tiene puntos todavía: el pozo se reparte cuando se acepte la primera tarea.
                </p>
              )}
            </div>

            {preview.unassigned > 0 && (
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                {money(preview.unassigned)} del pozo quedaron sin dueño por el tope individual y se
                suman a la reserva de la empresa.
              </p>
            )}

            {canLiquidate && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  id="payout-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Concepto (ej: anticipo del cliente)"
                  className="flex-1 min-w-[180px] h-9 rounded-lg bg-gray-800 border border-gray-700 px-3 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={liquidate}
                  disabled={isLiquidating || preview.totalPoints <= 0}
                  className="h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Liquidar {money(preview.available)}
                </button>
                <p className="w-full text-[11px] text-gray-600 leading-relaxed">
                  Al liquidar, estos porcentajes quedan congelados y cada parte entra a Ganancias.
                  Lo que se gane después no cambia este pago.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {payouts.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <p className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 text-xs font-medium text-gray-300">
            <Lock className="w-3.5 h-3.5 text-gray-500" />
            Liquidaciones congeladas
          </p>
          <div className="divide-y divide-gray-800">
            {payouts.map((p) => (
              <div key={p.id} className="px-4 py-3 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-gray-200">{p.description}</span>
                  <span className="text-[11px] text-gray-500">{shortDate(p.createdAt)}</span>
                  <span className="ml-auto text-sm text-gray-200 tabular-nums">{money(p.netAmount)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 tabular-nums">
                  <span>Empresa {money(p.companyAmount)}</span>
                  <span>Fundador {money(p.founderAmount)}</span>
                  <span>Pozo {money(p.poolAmount)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 tabular-nums">
                  {p.shares.map((s) => (
                    <span key={s.userId}>
                      {firstName(s)} {money(s.amount)}
                      <span className="text-gray-600"> ({s.percentage} %)</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
