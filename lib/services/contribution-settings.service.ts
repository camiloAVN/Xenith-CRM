import { prisma } from '@/lib/db/prisma'

/**
 * Parámetros del sistema de puntos, ya resueltos a números planos.
 *
 * En la base viven como Decimal (Prisma los serializa a string en JSON), pero
 * todo el cálculo de puntos los usa como number, así que la conversión ocurre
 * una sola vez aquí.
 */
export interface ContributionSettings {
  minVotes: number
  minPoints: number
  maxPoints: number
  /** Penalización por día de la etapa anterior. Solo para leer el histórico. */
  penaltyPerDay: number
  penaltyFloorRatio: number
  disagreementDelta: number
  votingWindowHours: number
  /** Duración por defecto de un sprint nuevo. */
  sprintLengthDays: number
  /** Tope de puntos por persona con el que nace cada sprint. */
  defaultCapacityPoints: number
  /** Descuento por cada arrastre a otro sprint. */
  carryoverPenalty: number
  /** Descuento por cada rechazo de los jefes. */
  reworkPenalty: number
}

/**
 * Fallback si la fila global llegara a faltar. Coincide con los `@default`.
 *
 * `minPoints` / `maxPoints` son los extremos de la escala Fibonacci (1 y 21),
 * no un rango continuo: los valores que se pueden votar salen de
 * `allowedScale()` en `point-scale.ts`.
 *
 * `disagreementDelta` se mide en PELDAÑOS de la escala (2 = dos saltos, por
 * ejemplo 3 contra 8), no en puntos.
 */
export const DEFAULT_SETTINGS: ContributionSettings = {
  minVotes: 2,
  minPoints: 1,
  maxPoints: 21,
  penaltyPerDay: 0.2,
  penaltyFloorRatio: 0.5,
  disagreementDelta: 2,
  votingWindowHours: 24,
  sprintLengthDays: 14,
  defaultCapacityPoints: 13,
  carryoverPenalty: 0.2,
  reworkPenalty: 0.25,
}

type SettingsRow = {
  minVotes: number
  minPoints: number
  maxPoints: number
  penaltyPerDay: unknown
  penaltyFloorRatio: unknown
  disagreementDelta: number
  votingWindowHours: number
  sprintLengthDays: number
  defaultCapacityPoints: number
  carryoverPenalty: unknown
  reworkPenalty: unknown
}

function toSettings(row: SettingsRow): ContributionSettings {
  return {
    minVotes: row.minVotes,
    minPoints: row.minPoints,
    maxPoints: row.maxPoints,
    penaltyPerDay: Number(row.penaltyPerDay),
    penaltyFloorRatio: Number(row.penaltyFloorRatio),
    disagreementDelta: row.disagreementDelta,
    votingWindowHours: row.votingWindowHours,
    sprintLengthDays: row.sprintLengthDays,
    defaultCapacityPoints: row.defaultCapacityPoints,
    carryoverPenalty: Number(row.carryoverPenalty),
    reworkPenalty: Number(row.reworkPenalty),
  }
}

export const contributionSettingsService = {
  /**
   * Configuración vigente para un proyecto: su override si existe, y si no,
   * la global. Ambas filas se traen en una sola consulta.
   */
  async resolve(projectId?: string | null): Promise<ContributionSettings> {
    const rows = await prisma.contributionSettings.findMany({
      where: projectId ? { OR: [{ projectId }, { projectId: null }] } : { projectId: null },
    })

    const override = projectId ? rows.find((r) => r.projectId === projectId) : undefined
    const global = rows.find((r) => r.projectId === null)
    const row = override ?? global

    return row ? toSettings(row) : DEFAULT_SETTINGS
  },

  async getGlobal(): Promise<ContributionSettings> {
    return this.resolve(null)
  },

  /** Devuelve el override del proyecto, o null si hereda el global. */
  async getProjectOverride(projectId: string): Promise<ContributionSettings | null> {
    const row = await prisma.contributionSettings.findUnique({ where: { projectId } })
    return row ? toSettings(row) : null
  },

  async updateGlobal(
    data: Partial<ContributionSettings>,
    updatedById: string
  ): Promise<ContributionSettings> {
    const row = await prisma.contributionSettings.upsert({
      where: { id: 'global' },
      update: { ...data, updatedById },
      create: { id: 'global', projectId: null, ...data, updatedById },
    })
    return toSettings(row)
  },

  async updateForProject(
    projectId: string,
    data: Partial<ContributionSettings>,
    updatedById: string
  ): Promise<ContributionSettings> {
    const row = await prisma.contributionSettings.upsert({
      where: { projectId },
      update: { ...data, updatedById },
      create: { projectId, ...data, updatedById },
    })
    return toSettings(row)
  },

  /** Quita el override del proyecto: vuelve a heredar la configuración global. */
  async clearProjectOverride(projectId: string): Promise<void> {
    await prisma.contributionSettings.deleteMany({ where: { projectId } })
  },
}
