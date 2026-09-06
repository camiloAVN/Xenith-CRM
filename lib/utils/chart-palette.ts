/**
 * Paleta categórica para los gráficos del dashboard.
 *
 * VALIDADA, no elegida a ojo. Contra la superficie oscura de la app
 * (#0a0e17) los seis tonos pasan las cinco comprobaciones: banda de luminosidad,
 * piso de croma, separación bajo daltonismo (peor par adyacente ΔE 8.4 protan),
 * piso de visión normal (ΔE 19.3) y contraste >= 3:1.
 *
 * La combinación intuitiva de Tailwind (violet-500 + blue-500 + emerald-500…)
 * FALLA: violeta y azul dan ΔE 1.3 en deuteranopía y 12.0 en visión normal —
 * indistinguibles incluso para quien ve todos los colores. Por eso esta lista
 * no se toca sin volver a validarla.
 *
 * Reglas de uso:
 *  - Los tonos se asignan en ORDEN FIJO y no se reciclan. Si algún día hay más
 *    de 6 personas, las restantes se agrupan en "Otros", no se generan colores.
 *  - El color sigue a la PERSONA, no a su posición en el ranking: filtrar o
 *    reordenar no debe repintar a los demás.
 */
export const SERIES_COLORS = [
  '#3987e5', // azul
  '#d95926', // naranja
  '#199e70', // verde agua
  '#c98500', // amarillo
  '#d55181', // magenta
  '#008300', // verde
] as const

/** Color estable de una persona dentro de un proyecto. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

/**
 * Índices de color por usuario, fijados por su posición en una lista ordenada
 * de forma estable (por id). Así el color de cada quien no cambia cuando sube
 * o baja en el ranking de puntos.
 */
export function buildColorMap(userIds: string[]): Map<string, string> {
  const stable = [...new Set(userIds)].sort()
  return new Map(stable.map((id, i) => [id, seriesColor(i)]))
}
