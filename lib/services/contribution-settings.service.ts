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
  penaltyPerDay: number
  penaltyFloorRatio: number
  disagreementDelta: number
  votingWindowHours: number
}

/** Fallback si la fila global llegara a faltar. Coincide con los @default. */
export const DEFAULT_SETTINGS: ContributionSettings = {
  minVotes: 2,
  minPoints: 2,
  maxPoints: 10,
  penaltyPerDay: 0.2,
  penaltyFloorRatio: 0.5,
  disagreementDelta: 5,
  votingWindowHours: 24,
}

type SettingsRow = {
  minVotes: number
  minPoints: number
  maxPoints: number
  penaltyPerDay: unknown
  penaltyFloorRatio: unknown
  disagreementDelta: number
  votingWindowHours: number
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
