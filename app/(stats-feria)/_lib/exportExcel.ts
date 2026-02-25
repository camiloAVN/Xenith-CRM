/**
 * exportExcel.ts — Generador profesional de Excel para estadísticas de feria
 * Usa ExcelJS para formatting rico + canvas para gráficas embebidas como PNG
 */

import type ExcelJS from 'exceljs'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  eventName: string
  clientName: string
  standName: string
  /** Hex color, e.g. '#3b82f6' */
  standColor: string
  hours: string[]
  dayLabels: string[]
  eventDates: string[]
  /** 3 arrays (days) × N values (hours) */
  standDays: number[][]
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS NUMÉRICOS
// ─────────────────────────────────────────────────────────────────────────────

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0)
}

function getDayTotal(days: number[][], i: number) {
  return sum(days[i])
}

function getTotal(days: number[][]) {
  return days.reduce((t, d) => t + sum(d), 0)
}

function hexToArgb(hex: string) {
  return 'FF' + hex.replace('#', '').toUpperCase()
}

/** Mezcla el color hex con blanco al ratio indicado (0=original, 1=blanco) */
function hexLighten(hex: string, ratio: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * ratio)
  const g = Math.round(((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * ratio)
  const b = Math.round((n & 0xff) + (255 - (n & 0xff)) * ratio)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// DIBUJO DE GRÁFICAS EN CANVAS
// ─────────────────────────────────────────────────────────────────────────────

interface ChartDataset {
  label: string
  data: number[]
  color: string
}

function drawBarChart(params: {
  labels: string[]
  datasets: ChartDataset[]
  title: string
  subtitle?: string
  width?: number
  height?: number
}): string {
  const { labels, datasets, title, subtitle, width = 900, height = 420 } = params

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const PAD = { top: subtitle ? 80 : 65, right: 40, bottom: datasets.length > 1 ? 75 : 55, left: 70 }
  const chartW = width - PAD.left - PAD.right
  const chartH = height - PAD.top - PAD.bottom

  const allVals = datasets.flatMap((d) => d.data)
  const maxVal = Math.max(...allVals)
  const niceMax = Math.ceil(maxVal / 50) * 50 || 1

  // ── Fondo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)

  // Borde exterior sutil
  ctx.strokeStyle = '#1e3a5f'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, width - 2, height - 2)

  // Área de la gráfica
  ctx.fillStyle = '#111827'
  ctx.fillRect(PAD.left, PAD.top, chartW, chartH)

  // ── Líneas de cuadrícula ────────────────────────────────────────────────────
  const gridCount = 5
  for (let i = 0; i <= gridCount; i++) {
    const y = PAD.top + (chartH / gridCount) * i
    ctx.strokeStyle = i === gridCount ? '#334155' : '#1e293b'
    ctx.lineWidth = i === gridCount ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(PAD.left, y)
    ctx.lineTo(PAD.left + chartW, y)
    ctx.stroke()

    const val = Math.round(niceMax - (niceMax / gridCount) * i)
    ctx.fillStyle = '#64748b'
    ctx.font = '11px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(val.toLocaleString('es-CO'), PAD.left - 10, y + 4)
  }

  // Línea eje Y
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(PAD.left, PAD.top)
  ctx.lineTo(PAD.left, PAD.top + chartH)
  ctx.stroke()

  // ── Título ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#f1f5f9'
  ctx.font = 'bold 17px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, width / 2, 32)

  if (subtitle) {
    ctx.fillStyle = '#64748b'
    ctx.font = '12px Arial, sans-serif'
    ctx.fillText(subtitle, width / 2, 52)
  }

  // ── Barras ─────────────────────────────────────────────────────────────────
  const groupW = chartW / labels.length
  const dsCount = datasets.length
  const barGap = 4
  const totalBarW = groupW * 0.75
  const barW = (totalBarW - barGap * (dsCount - 1)) / dsCount

  datasets.forEach((ds, di) => {
    ds.data.forEach((val, li) => {
      const barH = niceMax > 0 ? (val / niceMax) * chartH : 0
      const groupX = PAD.left + li * groupW + groupW * 0.125
      const x = groupX + di * (barW + barGap)
      const y = PAD.top + chartH - barH
      const r = Math.min(4, barW / 2)

      // Sombra de la barra
      ctx.shadowColor = ds.color + '55'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2

      // Degradado vertical de la barra
      const grad = ctx.createLinearGradient(x, y, x, y + barH)
      grad.addColorStop(0, ds.color)
      grad.addColorStop(1, ds.color + '99')
      ctx.fillStyle = grad

      ctx.beginPath()
      if (barH > r * 2) {
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + barW - r, y)
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
        ctx.lineTo(x + barW, y + barH)
        ctx.lineTo(x, y + barH)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
      } else {
        ctx.rect(x, y, barW, barH)
      }
      ctx.closePath()
      ctx.fill()

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Valor encima de la barra
      if (barH > 18) {
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${Math.min(11, Math.max(8, barW - 2))}px Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(val.toLocaleString('es-CO'), x + barW / 2, y - 5)
      }
    })
  })

  // ── Etiquetas eje X ────────────────────────────────────────────────────────
  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'center'
  labels.forEach((label, i) => {
    ctx.fillText(label, PAD.left + i * groupW + groupW / 2, PAD.top + chartH + 18)
  })

  // ── Leyenda (si hay múltiples datasets) ────────────────────────────────────
  if (dsCount > 1) {
    const legendTotalW = datasets.reduce((acc, ds) => acc + ctx.measureText(ds.label).width + 24, 0)
    let lx = (width - legendTotalW) / 2
    const ly = height - 22

    datasets.forEach((ds) => {
      // Cuadro de color con esquinas redondeadas
      ctx.fillStyle = ds.color
      ctx.fillRect(lx, ly - 10, 14, 10)

      ctx.fillStyle = '#cbd5e1'
      ctx.font = '11px Arial, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(ds.label, lx + 18, ly)
      lx += ctx.measureText(ds.label).width + 40
    })
  }

  return canvas.toDataURL('image/png')
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR EXCEL PROFESIONAL
// ─────────────────────────────────────────────────────────────────────────────

export async function exportStandExcel(opts: ExportOptions) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Xenith'
  wb.created = new Date()

  const { eventName, clientName, standName, standColor, hours, dayLabels, eventDates, standDays } = opts

  const ARGB_ACCENT = hexToArgb(standColor)
  const ARGB_ACCENT_LIGHT = hexToArgb(hexLighten(standColor, 0.85))
  const ARGB_DARK = 'FF0F172A'
  const ARGB_DARK2 = 'FF1E293B'
  const ARGB_MID = 'FF1E3347'
  const ARGB_WHITE = 'FFFFFFFF'
  const ARGB_GRAY = 'FF94A3B8'
  const ARGB_GRAY2 = 'FF475569'
  const ARGB_BORDER = 'FF334155'
  const ARGB_ROW_ALT = 'FF0D1B2A'

  const dayTotals = dayLabels.map((_, i) => getDayTotal(standDays, i))
  const grandTotal = getTotal(standDays)
  const avgPerDay = Math.round(grandTotal / dayLabels.length)

  const peakDayIdx = dayTotals.indexOf(Math.max(...dayTotals))
  const hourlyTotals = hours.map((_, hi) => sum(standDays.map((d) => d[hi])))
  const peakHourIdx = hourlyTotals.indexOf(Math.max(...hourlyTotals))

  const dateStr = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── Generar gráficas ────────────────────────────────────────────────────────
  const dailyChartB64 = drawBarChart({
    labels: dayLabels,
    datasets: [{ label: standName, data: dayTotals, color: standColor }],
    title: `${standName} — Total de Personas por Día`,
    subtitle: eventName,
    width: 800,
    height: 380,
  })

  const hourlyChartB64 = drawBarChart({
    labels: hours,
    datasets: standDays.map((dayData, i) => ({
      label: dayLabels[i],
      data: dayData,
      color: i === 0 ? standColor : i === 1 ? hexLighten(standColor, 0.25) : hexLighten(standColor, 0.5),
    })),
    title: `${standName} — Visitas por Hora (los 3 días)`,
    subtitle: eventName,
    width: 1100,
    height: 420,
  })

  const imgDailyId = wb.addImage({
    base64: dailyChartB64.replace('data:image/png;base64,', ''),
    extension: 'png',
  })

  const imgHourlyId = wb.addImage({
    base64: hourlyChartB64.replace('data:image/png;base64,', ''),
    extension: 'png',
  })

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 1 — RESUMEN
  // ════════════════════════════════════════════════════════════════════════════

  const ws1 = wb.addWorksheet('Resumen', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    properties: { tabColor: { argb: ARGB_ACCENT } },
  })

  ws1.columns = [
    { width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ]

  const addRow1 = (values: (string | number | null)[], height = 18) => {
    const r = ws1.addRow(values)
    r.height = height
    return r
  }

  const fill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
  })

  const border = (): Partial<ExcelJS.Borders> => ({
    top: { style: 'thin', color: { argb: ARGB_BORDER } },
    left: { style: 'thin', color: { argb: ARGB_BORDER } },
    bottom: { style: 'thin', color: { argb: ARGB_BORDER } },
    right: { style: 'thin', color: { argb: ARGB_BORDER } },
  })

  const fillRow = (row: ExcelJS.Row, argb: string, cols = 6) => {
    for (let c = 1; c <= cols; c++) {
      row.getCell(c).fill = fill(argb)
    }
  }

  // ── Fila 1: Título principal ─────────────────────────────────────────────
  ws1.mergeCells('A1:F1')
  const r1 = addRow1([`${eventName} — ${standName}`], 50)
  const c1 = r1.getCell(1)
  c1.font = { bold: true, size: 22, color: { argb: ARGB_WHITE }, name: 'Calibri' }
  c1.fill = fill(ARGB_DARK)
  c1.alignment = { horizontal: 'center', vertical: 'middle' }

  // Borde inferior de acento
  ws1.mergeCells('A2:F2')
  const r2 = addRow1([null], 5)
  fillRow(r2, ARGB_ACCENT)

  // ── Fila 3: Sub-cabecera ────────────────────────────────────────────────
  ws1.mergeCells('A3:F3')
  const r3 = addRow1([`Conteo de Personas — ${clientName}  ·  Generado el ${dateStr}`], 22)
  const c3 = r3.getCell(1)
  c3.font = { size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
  c3.fill = fill(ARGB_DARK)
  c3.alignment = { horizontal: 'center', vertical: 'middle' }

  // Espacio
  const rSp1 = addRow1([null], 10)
  fillRow(rSp1, ARGB_DARK)

  // ── Sección: TOTALES POR DÍA ─────────────────────────────────────────────
  ws1.mergeCells('A5:F5')
  const rSec1 = addRow1(['  TOTALES POR DÍA'], 26)
  const cSec1 = rSec1.getCell(1)
  cSec1.font = { bold: true, size: 12, color: { argb: ARGB_WHITE }, name: 'Calibri' }
  cSec1.fill = fill(ARGB_MID)
  cSec1.alignment = { vertical: 'middle' }

  // Cabeceras columnas
  const headers6 = ['', ...dayLabels, 'Total general', 'Promedio/día']
  const rH = addRow1(headers6, 22)
  fillRow(rH, ARGB_DARK2)
  rH.eachCell((cell, col) => {
    if (col > 1) {
      cell.font = { bold: true, size: 11, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border()
    }
  })

  // Fila de datos
  const dataVals = ['Personas contadas', ...dayTotals, grandTotal, avgPerDay]
  const rData = addRow1(dataVals, 30)
  fillRow(rData, ARGB_DARK)
  rData.eachCell((cell, col) => {
    cell.fill = fill(col === 1 ? ARGB_DARK : ARGB_DARK)
    cell.border = border()
    if (col === 1) {
      cell.font = { bold: true, size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
      cell.alignment = { vertical: 'middle' }
    } else if (col === dayLabels.length + 2) {
      // Total general — destacado
      cell.font = { bold: true, size: 14, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      cell.fill = fill(ARGB_ACCENT_LIGHT)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.numFmt = '#,##0'
    } else if (col === dayLabels.length + 3) {
      cell.font = { bold: false, size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.numFmt = '#,##0'
    } else {
      cell.font = { bold: true, size: 13, color: { argb: ARGB_WHITE }, name: 'Calibri' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.numFmt = '#,##0'
    }
  })

  // Espacio
  const rSp2 = addRow1([null], 14)
  fillRow(rSp2, ARGB_DARK)

  // ── Sección: INDICADORES CLAVE ───────────────────────────────────────────
  ws1.mergeCells('A9:F9')
  const rSec2 = addRow1(['  INDICADORES CLAVE'], 26)
  const cSec2 = rSec2.getCell(1)
  cSec2.font = { bold: true, size: 12, color: { argb: ARGB_WHITE }, name: 'Calibri' }
  cSec2.fill = fill(ARGB_MID)
  cSec2.alignment = { vertical: 'middle' }

  const kpis: [string, string | number, string][] = [
    ['Total acumulado (3 días)', grandTotal.toLocaleString('es-CO') + ' personas', ''],
    ['Promedio diario', avgPerDay.toLocaleString('es-CO') + ' personas/día', ''],
    ['Día más concurrido', dayLabels[peakDayIdx], `${dayTotals[peakDayIdx].toLocaleString('es-CO')} personas`],
    ['Hora pico (suma 3 días)', hours[peakHourIdx], `${hourlyTotals[peakHourIdx].toLocaleString('es-CO')} personas`],
  ]

  kpis.forEach(([label, value, extra], idx) => {
    ws1.mergeCells(`B${10 + idx}:C${10 + idx}`)
    ws1.mergeCells(`D${10 + idx}:F${10 + idx}`)
    const rKpi = addRow1([label, value, null, extra || null], 22)
    fillRow(rKpi, idx % 2 === 0 ? ARGB_DARK : ARGB_ROW_ALT)
    rKpi.eachCell((cell, col) => {
      cell.border = border()
      if (col === 1) {
        cell.font = { size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
      } else if (col === 2) {
        cell.font = { bold: true, size: 12, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (col === 4) {
        cell.font = { size: 10, color: { argb: ARGB_GRAY2 }, name: 'Calibri' }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
  })

  // Espacio antes de la gráfica
  for (let i = 0; i < 2; i++) {
    const rEmpty = addRow1([null], 10)
    fillRow(rEmpty, ARGB_DARK)
  }

  // ── Gráfica diaria (embedded) ────────────────────────────────────────────
  ws1.addImage(imgDailyId, {
    tl: { col: 0, row: 15 },
    ext: { width: 700, height: 320 },
  })

  // Filas de espacio para la imagen
  for (let i = 0; i < 18; i++) {
    const rImg = addRow1([null], 18)
    fillRow(rImg, ARGB_DARK)
  }

  // Footer
  ws1.mergeCells(`A34:F34`)
  const rFoot = addRow1([`Reporte generado por Xenith · ${new Date().getFullYear()} · Datos del evento: ${eventName}`], 18)
  const cFoot = rFoot.getCell(1)
  cFoot.font = { size: 9, italic: true, color: { argb: ARGB_GRAY2 }, name: 'Calibri' }
  cFoot.fill = fill(ARGB_DARK)
  cFoot.alignment = { horizontal: 'center' }

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 2 — VISITAS POR HORA
  // ════════════════════════════════════════════════════════════════════════════

  const ws2 = wb.addWorksheet('Visitas por Hora', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    properties: { tabColor: { argb: ARGB_ACCENT } },
  })

  ws2.columns = [
    { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ]

  const addRow2 = (values: (string | number | null)[], height = 18) => {
    const r = ws2.addRow(values)
    r.height = height
    return r
  }

  const fill2 = fill
  const border2 = border

  const fillRow2 = (row: ExcelJS.Row, argb: string, cols = 6) => {
    for (let c = 1; c <= cols; c++) row.getCell(c).fill = fill2(argb)
  }

  // Encabezado
  ws2.mergeCells('A1:F1')
  const ws2r1 = addRow2([`${eventName} — ${standName} · Visitas por Hora`], 45)
  const ws2c1 = ws2r1.getCell(1)
  ws2c1.font = { bold: true, size: 18, color: { argb: ARGB_WHITE }, name: 'Calibri' }
  ws2c1.fill = fill2(ARGB_DARK)
  ws2c1.alignment = { horizontal: 'center', vertical: 'middle' }

  ws2.mergeCells('A2:F2')
  const ws2r2 = addRow2([null], 5)
  fillRow2(ws2r2, ARGB_ACCENT)

  ws2.mergeCells('A3:F3')
  const ws2r3 = addRow2([`Distribución horaria del flujo de personas — ${clientName}`], 20)
  ws2r3.getCell(1).font = { size: 10, color: { argb: ARGB_GRAY }, name: 'Calibri' }
  ws2r3.getCell(1).fill = fill2(ARGB_DARK)
  ws2r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  const rSp3 = addRow2([null], 10)
  fillRow2(rSp3, ARGB_DARK)

  // Cabeceras de la tabla
  const tblHeaders = ['Hora', ...dayLabels, 'Total día', 'Promedio']
  const rTblH = addRow2(tblHeaders, 26)
  fillRow2(rTblH, ARGB_MID)
  rTblH.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: ARGB_WHITE }, name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border2()
  })

  // Filas de datos por hora
  hours.forEach((hour, hi) => {
    const vals = standDays.map((d) => d[hi])
    const rowTotal = sum(vals)
    const rowAvg = Math.round(rowTotal / vals.length)
    const rowMax = Math.max(...vals)
    const rowArr = [hour, ...vals, rowTotal, rowAvg]
    const rHour = addRow2(rowArr, 20)
    const isAlt = hi % 2 === 0
    fillRow2(rHour, isAlt ? ARGB_DARK : ARGB_ROW_ALT)
    rHour.eachCell((cell, col) => {
      cell.border = border2()
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      if (col === 1) {
        cell.font = { bold: true, size: 11, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      } else if (col >= 2 && col <= dayLabels.length + 1) {
        const val = vals[col - 2]
        const isPeak = val === rowMax && rowMax > 0
        cell.font = {
          bold: isPeak,
          size: 11,
          color: { argb: isPeak ? ARGB_ACCENT : ARGB_WHITE },
          name: 'Calibri',
        }
        if (isPeak) cell.fill = fill2(ARGB_ACCENT_LIGHT)
        cell.numFmt = '#,##0'
      } else if (col === dayLabels.length + 2) {
        cell.font = { bold: true, size: 11, color: { argb: ARGB_WHITE }, name: 'Calibri' }
        cell.numFmt = '#,##0'
      } else {
        cell.font = { size: 10, color: { argb: ARGB_GRAY }, name: 'Calibri' }
        cell.numFmt = '#,##0'
      }
    })
  })

  // Fila de totales
  const totalsArr = ['TOTALES', ...dayTotals, grandTotal, avgPerDay]
  const rTotals = addRow2(totalsArr, 28)
  fillRow2(rTotals, ARGB_MID)
  rTotals.eachCell((cell, col) => {
    cell.border = border2()
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    if (col === 1) {
      cell.font = { bold: true, size: 12, color: { argb: ARGB_WHITE }, name: 'Calibri' }
    } else if (col === dayLabels.length + 2) {
      cell.font = { bold: true, size: 14, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      cell.numFmt = '#,##0'
    } else {
      cell.font = { bold: true, size: 12, color: { argb: ARGB_WHITE }, name: 'Calibri' }
      cell.numFmt = '#,##0'
    }
  })

  // Espacio + gráfica horaria
  for (let i = 0; i < 2; i++) {
    const rE = addRow2([null], 10)
    fillRow2(rE, ARGB_DARK)
  }

  const hourlyChartRow = 5 + hours.length + 3 // header rows + data + totals + space
  ws2.addImage(imgHourlyId, {
    tl: { col: 0, row: hourlyChartRow },
    ext: { width: 820, height: 340 },
  })

  for (let i = 0; i < 22; i++) {
    const rE = addRow2([null], 17)
    fillRow2(rE, ARGB_DARK)
  }

  // Footer
  ws2.mergeCells(`A${hourlyChartRow + 23}:F${hourlyChartRow + 23}`)
  const rFoot2 = addRow2([`Reporte generado por Xenith · ${new Date().getFullYear()}`], 16)
  rFoot2.getCell(1).font = { size: 9, italic: true, color: { argb: ARGB_GRAY2 }, name: 'Calibri' }
  rFoot2.getCell(1).fill = fill2(ARGB_DARK)
  rFoot2.getCell(1).alignment = { horizontal: 'center' }

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 3 — RESUMEN POR DÍA
  // ════════════════════════════════════════════════════════════════════════════

  const ws3 = wb.addWorksheet('Por Día', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
    properties: { tabColor: { argb: ARGB_ACCENT } },
  })

  ws3.columns = [
    { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 },
  ]

  const addRow3 = (values: (string | number | null)[], height = 18) => {
    const r = ws3.addRow(values)
    r.height = height
    return r
  }
  const fillRow3 = (row: ExcelJS.Row, argb: string, cols = 5) => {
    for (let c = 1; c <= cols; c++) row.getCell(c).fill = fill(argb)
  }

  // Encabezado
  ws3.mergeCells('A1:E1')
  const ws3r1 = addRow3([`${standName} — Resumen por Día`], 40)
  ws3r1.getCell(1).font = { bold: true, size: 16, color: { argb: ARGB_WHITE }, name: 'Calibri' }
  ws3r1.getCell(1).fill = fill(ARGB_DARK)
  ws3r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  ws3.mergeCells('A2:E2')
  const ws3Accent = addRow3([null], 4)
  fillRow3(ws3Accent, ARGB_ACCENT)

  ws3.mergeCells('A3:E3')
  const ws3r3 = addRow3([eventName + ' — ' + clientName], 18)
  ws3r3.getCell(1).font = { size: 10, color: { argb: ARGB_GRAY }, name: 'Calibri' }
  ws3r3.getCell(1).fill = fill(ARGB_DARK)
  ws3r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  const ws3sp = addRow3([null], 12)
  fillRow3(ws3sp, ARGB_DARK)

  // Cabecera tabla
  const ws3Headers = ['Día', 'Fecha', 'Personas', '% del Total', 'vs Promedio']
  const ws3rH = addRow3(ws3Headers, 24)
  fillRow3(ws3rH, ARGB_MID)
  ws3rH.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: ARGB_WHITE }, name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = border()
  })

  // Filas de datos
  dayLabels.forEach((day, i) => {
    const total = dayTotals[i]
    const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) + '%' : '0%'
    const diff = total - avgPerDay
    const diffStr = (diff >= 0 ? '+' : '') + diff.toLocaleString('es-CO')
    const dateLabel = eventDates[i].split('·')[1]?.trim() ?? ''

    const ws3rD = addRow3([day, dateLabel, total, pct, diffStr], 24)
    fillRow3(ws3rD, i % 2 === 0 ? ARGB_DARK : ARGB_ROW_ALT)
    ws3rD.eachCell((cell, col) => {
      cell.border = border()
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      if (col === 1) {
        cell.font = { bold: true, size: 11, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      } else if (col === 3) {
        cell.font = { bold: true, size: 13, color: { argb: ARGB_WHITE }, name: 'Calibri' }
        cell.numFmt = '#,##0'
        if (i === peakDayIdx) cell.fill = fill(ARGB_ACCENT_LIGHT)
      } else if (col === 4) {
        cell.font = { size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
      } else if (col === 5) {
        const isPos = diff >= 0
        cell.font = { bold: true, size: 11, color: { argb: isPos ? 'FF22C55E' : 'FFEF4444' }, name: 'Calibri' }
      } else {
        cell.font = { size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
      }
    })
  })

  // Fila de totales
  const ws3rTot = addRow3(['TOTAL', '', grandTotal, '100%', '—'], 28)
  fillRow3(ws3rTot, ARGB_MID)
  ws3rTot.eachCell((cell, col) => {
    cell.border = border()
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    if (col === 1) {
      cell.font = { bold: true, size: 12, color: { argb: ARGB_WHITE }, name: 'Calibri' }
    } else if (col === 3) {
      cell.font = { bold: true, size: 14, color: { argb: ARGB_ACCENT }, name: 'Calibri' }
      cell.numFmt = '#,##0'
    } else {
      cell.font = { size: 11, color: { argb: ARGB_GRAY }, name: 'Calibri' }
    }
  })

  // Espacio + nota
  const ws3sp2 = addRow3([null], 12)
  fillRow3(ws3sp2, ARGB_DARK)
  ws3.mergeCells('A12:E12')
  const ws3rNote = addRow3([`* Los valores en "vs Promedio" comparan cada día contra el promedio diario de ${avgPerDay.toLocaleString('es-CO')} personas.`], 18)
  ws3rNote.getCell(1).font = { size: 9, italic: true, color: { argb: ARGB_GRAY2 }, name: 'Calibri' }
  ws3rNote.getCell(1).fill = fill(ARGB_DARK)

  // ── Generar y descargar ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `feria-${standName.toLowerCase().replace(/\s+/g, '-')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
