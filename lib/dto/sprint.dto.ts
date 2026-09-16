import { z } from 'zod'

/**
 * Sprints. Las fechas son opcionales al crear: si no vienen, el servicio usa
 * hoy + `sprintLengthDays` de la configuración (2 semanas por defecto).
 */
export const CreateSprintSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  goal: z.string().max(280).optional().nullable(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
})

export const UpdateSprintSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  goal: z.string().max(280).optional().nullable(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
})

/** Al cerrar, a dónde se arrastra lo que no se aceptó. null = al backlog. */
export const CloseSprintSchema = z.object({
  nextSprintId: z.string().min(1).optional().nullable(),
})

export const SetCapacitySchema = z.object({
  userId: z.string().min(1),
  points: z.number().int().min(0).max(100),
})

export type CreateSprintDTO = z.infer<typeof CreateSprintSchema>
export type UpdateSprintDTO = z.infer<typeof UpdateSprintSchema>
