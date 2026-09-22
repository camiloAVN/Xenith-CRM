/**
 * `fetch` con reintento para la API interna.
 *
 * La base de datos tiene un cupo de conexiones muy pequeño: con dos personas
 * usando el tablero al tiempo, una petición puede rebotar con 503 aunque todo
 * esté bien. Reintentar con espera convierte ese rebote en un parpadeo, en
 * lugar de una pantalla rota.
 *
 * Solo reintenta lo que tiene sentido reintentar: 503/502/504 y los fallos de
 * red. Un 403 o un 404 se devuelven tal cual, a la primera.
 */

const RETRY_DELAYS_MS = [600, 1800]
const RETRYABLE_STATUS = new Set([502, 503, 504])

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  delays: number[] = RETRY_DELAYS_MS
): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt - 1]))
    try {
      const res = await fetch(input, init)
      if (!RETRYABLE_STATUS.has(res.status) || attempt === delays.length) return res
    } catch (error) {
      lastError = error
      if (attempt === delays.length) throw error
    }
  }

  // Inalcanzable: el bucle sale por return o por throw.
  throw lastError ?? new Error('fetchWithRetry agotó los intentos')
}
