'use client'

/**
 * PÁGINA DE ESTADÍSTICAS — STAND 1 — ANATO FONTUR 2026
 * Acceso: /estadisticas-anato-fontur (solo por URL directo, sin navegación interna)
 *
 * Para eliminar: borrar la carpeta completa app/(stats-feria)/
 * Dependencia temporal: xlsx (npm uninstall xlsx al eliminar)
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Download, Users, TrendingUp, Clock, Calendar, BarChart3, ExternalLink } from 'lucide-react'
import { exportStandExcel } from '../_lib/exportExcel'

// ═══════════════════════════════════════════════════════════════
// DATOS DEL EVENTO — Reemplazar con datos reales cuando estén listos
// ═══════════════════════════════════════════════════════════════

const EVENT_NAME = 'ANATO Fontur 2026'
const CLIENT_NAME = 'Anato'
const STAND_NAME = 'Stand 1'
const HOURS = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm']
const DAY_LABELS = ['Día 1', 'Día 2', 'Día 3']
const EVENT_DATES = ['Día 1 · 10 Mar', 'Día 2 · 11 Mar', 'Día 3 · 12 Mar']

const STAND_COLOR = '#3b82f6'
const STAND_BG = 'rgba(59,130,246,0.08)'

// Datos ficticios Stand 1 — reemplazar con datos reales
const STAND_DAYS: number[][] = [
  [45, 72, 98, 134, 89, 112, 156, 143, 87, 52, 60],
  [38, 65, 104, 128, 95, 118, 167, 152, 91, 48, 80],
  [52, 81, 115, 142, 103, 127, 178, 162, 96, 63, 120],
]

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0)
}

function getDayTotal(dayIdx: number) {
  return sum(STAND_DAYS[dayIdx])
}

function getTotal() {
  return STAND_DAYS.reduce((t, day) => t + sum(day), 0)
}

function getPeakHour(dayIdx: number) {
  const data = STAND_DAYS[dayIdx]
  const maxVal = Math.max(...data)
  return { hour: HOURS[data.indexOf(maxVal)], value: maxVal }
}

function getPeakDay() {
  const totals = STAND_DAYS.map((_, i) => getDayTotal(i))
  const maxTotal = Math.max(...totals)
  return { day: DAY_LABELS[totals.indexOf(maxTotal)], value: maxTotal }
}

function lighten(hex: string, amount: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `rgb(${r},${g},${b})`
}

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

async function downloadExcel() {
  await exportStandExcel({
    eventName: EVENT_NAME,
    clientName: CLIENT_NAME,
    standName: STAND_NAME,
    standColor: STAND_COLOR,
    hours: HOURS,
    dayLabels: DAY_LABELS,
    eventDates: EVENT_DATES,
    standDays: STAND_DAYS,
  })
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE: Gráfica de barras por hora
// ═══════════════════════════════════════════════════════════════

function HourlyChart({ data }: { data: number[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data)

  const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0]

  return (
    <div className="w-full select-none">
      <div className="flex gap-2">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pb-6 text-right shrink-0 w-8">
          {ticks.map((tick, i) => (
            <span key={i} className="text-xs text-slate-600 leading-none">
              {tick}
            </span>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-0">
          <div className="relative h-44">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {ticks.map((_, i) => (
                <div key={i} className="w-full border-t border-slate-800/70" />
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-[3px] px-[2px]">
              {data.map((value, i) => {
                const heightPct = max > 0 ? (value / max) * 100 : 0
                const isHovered = hovered === i
                const isDimmed = hovered !== null && !isHovered

                return (
                  <div
                    key={i}
                    className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isHovered && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        <div className="bg-white text-slate-900 text-xs font-bold px-2 py-1 rounded-md shadow-xl whitespace-nowrap">
                          {value.toLocaleString()} personas
                        </div>
                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white mx-auto" />
                      </div>
                    )}
                    <div
                      className="w-full rounded-t-sm transition-all duration-100"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: isHovered ? lighten(STAND_COLOR, 40) : STAND_COLOR,
                        minHeight: value > 0 ? '3px' : '0',
                        opacity: isDimmed ? 0.35 : 1,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex gap-[3px] px-[2px] mt-1">
            {HOURS.map((hour, i) => (
              <div
                key={i}
                className={`flex-1 text-center text-xs truncate transition-colors ${
                  hovered === i ? 'text-white font-semibold' : 'text-slate-600'
                }`}
              >
                {hour}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE: Gráfica de totales por día
// ═══════════════════════════════════════════════════════════════

function DailyChart() {
  const [hovered, setHovered] = useState<number | null>(null)
  const totals = STAND_DAYS.map((_, i) => getDayTotal(i))
  const max = Math.max(...totals)

  return (
    <div className="w-full select-none">
      <div className="h-28 flex items-end gap-6">
        {totals.map((total, i) => {
          const heightPct = max > 0 ? (total / max) * 100 : 0
          const isHovered = hovered === i
          const isDimmed = hovered !== null && !isHovered

          return (
            <div
              key={i}
              className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                  <div className="bg-white text-slate-900 text-xs font-bold px-2 py-1 rounded-md shadow-xl whitespace-nowrap">
                    {total.toLocaleString()} personas
                  </div>
                  <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white mx-auto" />
                </div>
              )}
              <div
                className="w-full rounded-t-md transition-all duration-150"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isHovered ? lighten(STAND_COLOR, 40) : STAND_COLOR,
                  minHeight: '4px',
                  opacity: isDimmed ? 0.35 : 1,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-6 mt-2">
        {totals.map((total, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-xs text-slate-500">{DAY_LABELS[i]}</div>
            <div className="text-base font-bold text-white mt-0.5">
              {total.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600">{EVENT_DATES[i].split('·')[1]?.trim()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function EstadisticasStand1() {
  const [selectedDay, setSelectedDay] = useState(0)
  const [exporting, setExporting] = useState(false)

  const total = getTotal()
  const peak = getPeakHour(selectedDay)
  const peakDay = getPeakDay()
  const avgPerDay = Math.round(total / DAY_LABELS.length)

  async function handleExport() {
    setExporting(true)
    try {
      await downloadExcel()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/inicio">
              <Image
                src="/images/xenith-logo.png"
                alt="XENITH"
                width={120}
                height={32}
                className="h-8 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
              />
            </Link>
            <div className="h-8 w-px bg-slate-700 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-0.5">
                {CLIENT_NAME}
              </div>
              <h1 className="text-lg font-bold text-white leading-tight">
                {EVENT_NAME} —{' '}
                <span style={{ color: STAND_COLOR }}>{STAND_NAME}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/inicio"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
            >
              Conoce más
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60 disabled:cursor-wait"
              style={{
                backgroundColor: 'rgba(59,130,246,0.1)',
                borderColor: 'rgba(59,130,246,0.3)',
                color: '#60a5fa',
              }}
              onMouseEnter={(e) => {
                if (!exporting) e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'
              }}
            >
              <Download size={11} className={exporting ? 'animate-bounce' : ''} />
              {exporting ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {DAY_LABELS.map((day, i) => (
            <div key={i} className="rounded-xl border border-slate-800 p-5 bg-slate-900">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar size={13} style={{ color: STAND_COLOR }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: STAND_COLOR }}>
                  {day}
                </span>
              </div>
              <div className="text-3xl font-black text-white tabular-nums">
                {getDayTotal(i).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {EVENT_DATES[i].split('·')[1]?.trim()}
              </div>
            </div>
          ))}

          {/* Total general */}
          <div
            className="rounded-xl border p-5 col-span-2 sm:col-span-1"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
              borderColor: 'rgba(59,130,246,0.35)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <Users size={13} className="text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Total
              </span>
            </div>
            <div className="text-3xl font-black text-white tabular-nums">
              {total.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">personas · 3 días</div>
          </div>
        </div>

        {/* ── Indicadores rápidos ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/50 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: STAND_BG }}
            >
              <TrendingUp size={16} style={{ color: STAND_COLOR }} />
            </div>
            <div>
              <div className="text-xs text-slate-500">Promedio diario</div>
              <div className="text-lg font-bold text-white">{avgPerDay.toLocaleString()}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/50 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: STAND_BG }}
            >
              <Calendar size={16} style={{ color: STAND_COLOR }} />
            </div>
            <div>
              <div className="text-xs text-slate-500">Día más concurrido</div>
              <div className="text-lg font-bold text-white">{peakDay.day}</div>
              <div className="text-xs text-slate-600">{peakDay.value.toLocaleString()} personas</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 p-4 bg-slate-900/50 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: STAND_BG }}
            >
              <Clock size={16} style={{ color: STAND_COLOR }} />
            </div>
            <div>
              <div className="text-xs text-slate-500">
                Hora pico — {DAY_LABELS[selectedDay]}
              </div>
              <div className="text-lg font-bold text-white">{peak.hour}</div>
              <div className="text-xs text-slate-600">{peak.value.toLocaleString()} personas</div>
            </div>
          </div>
        </div>

        {/* ── Gráfica por hora ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 mb-6">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-slate-500" />
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Visitas por hora
              </h2>
            </div>

            {/* Day selector */}
            <div className="flex gap-1 bg-slate-800/80 rounded-lg p-1">
              {DAY_LABELS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150"
                  style={
                    selectedDay === i
                      ? { backgroundColor: STAND_COLOR, color: '#fff' }
                      : { color: '#94a3b8' }
                  }
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Peak hour pill */}
          <div
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full mb-5 font-medium"
            style={{ backgroundColor: STAND_BG, color: STAND_COLOR }}
          >
            <Clock size={11} />
            Hora pico: <span className="font-bold">{peak.hour}</span> —{' '}
            {peak.value.toLocaleString()} personas
          </div>

          <HourlyChart data={STAND_DAYS[selectedDay]} />
        </div>

        {/* ── Gráfica por día ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={14} className="text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total por día
            </h2>
          </div>
          <DailyChart />
        </div>

        {/* ── Footer ── */}
        <div className="mt-10 pb-4 text-center space-y-1">
          <p className="text-xs text-slate-600">
            Reporte generado por{' '}
            <span className="text-slate-500 font-semibold">Xenith</span> ·{' '}
            {new Date().getFullYear()}
          </p>
          <p className="text-xs text-slate-700 italic">
            Datos de ejemplo — reemplazar con información real del evento
          </p>
        </div>
      </main>
    </div>
  )
}
