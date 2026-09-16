/**
 * Escala de estimación (Scrum, Fibonacci 1–21).
 *
 * Los puntos miden TAMAÑO: complejidad, incertidumbre y esfuerzo. La escala
 * crece a saltos a propósito: obliga a decidir entre "esto es un 5" y "esto es
 * un 8" en vez de discutir si es 6 o 7.
 *
 * Las anclas son la otra mitad del sistema. Una escala sin anclas se infla
 * sola —en enero un 5 es una jornada y en junio son dos horas—, así que viven
 * junto a la escala y se muestran en la pantalla de votación y en el correo.
 */

export const FIBONACCI_SCALE = [1, 2, 3, 5, 8, 13, 21] as const

/** Una tarea de este tamaño es una épica: hay que partirla antes de trabajarla. */
export const EPIC_POINTS = 21

export interface ScaleAnchor {
  /** Qué significa el número, en tiempo real de trabajo. */
  label: string
  /** Matiz que evita que el número se estire con el tiempo. */
  hint: string
}

export const SCALE_ANCHORS: Record<number, ScaleAnchor> = {
  1: { label: 'Trivial, menos de una hora', hint: 'Sin incertidumbre' },
  2: { label: 'Un par de horas', hint: 'Camino conocido' },
  3: { label: 'Media jornada', hint: 'Un detalle por resolver' },
  5: { label: 'Una jornada completa', hint: 'Varias partes conectadas' },
  8: { label: 'Dos o tres días', hint: 'Incertidumbre real' },
  13: { label: 'Casi un sprint', hint: 'Señal de que hay que partirla' },
  21: { label: 'Épica', hint: 'No se trabaja así: se parte' },
}

/** Valores que se pueden votar, recortados por los límites configurados. */
export function allowedScale(minPoints: number, maxPoints: number): number[] {
  const values = FIBONACCI_SCALE.filter((v) => v >= minPoints && v <= maxPoints)
  // Si alguien deja una configuración sin ningún valor dentro, la escala
  // completa es mejor que un tablero sin botones para votar.
  return values.length > 0 ? [...values] : [...FIBONACCI_SCALE]
}

export function isOnScale(value: number, scale: number[]): boolean {
  return scale.includes(value)
}

/**
 * Lleva un número cualquiera al valor más cercano de la escala.
 *
 * La mediana de dos votos cae entre dos peldaños (3 y 8 dan 5.5) y el ledger
 * solo debe guardar valores de la escala. **Los empates bajan**: a mitad de
 * camino entre 8 y 13 se acredita 8. Es la dirección que no premia inflar.
 */
export function snapToScale(value: number, scale: number[]): number {
  let best = scale[0]
  let bestDistance = Math.abs(value - best)
  for (const candidate of scale) {
    const distance = Math.abs(value - candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

/**
 * Distancia en PELDAÑOS entre dos votos, no en puntos.
 *
 * En una escala que salta de 13 a 21, una diferencia de 8 puntos entre dos
 * votos vecinos no es desacuerdo; entre 3 y 8 sí lo es aunque sean 5 puntos.
 * Por eso el desacuerdo se mide en pasos de la escala.
 */
export function stepsBetween(a: number, b: number, scale: number[]): number {
  const ia = scale.indexOf(snapToScale(a, scale))
  const ib = scale.indexOf(snapToScale(b, scale))
  return Math.abs(ia - ib)
}

/** Texto corto de la escala para correos y avisos: "1, 2, 3, 5, 8, 13 o 21". */
export function describeScale(scale: number[]): string {
  if (scale.length === 0) return ''
  if (scale.length === 1) return String(scale[0])
  return `${scale.slice(0, -1).join(', ')} o ${scale[scale.length - 1]}`
}
