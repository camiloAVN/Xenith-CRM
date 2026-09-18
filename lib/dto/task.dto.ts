import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(255),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  // Desde la Fase 2 la tarea puede nacer SIN asignado: el equipo la estima
  // primero y se reparte después, en la planeación del sprint. Así nadie vota
  // sabiendo de quién es, que es lo que anclaba el número.
  assignedTo: z.string().min(1).optional().nullable(),
  reporterId: z.string().optional().nullable(),
  dueDate: z.string().min(1).optional().nullable(),
  // Sprint al que entra. Sin sprint la tarea queda en el backlog.
  sprintId: z.string().min(1).optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional().default([]),
})

/**
 * Actualización. `assignedTo`, `dueDate` y `sprintId` sí pueden vaciarse
 * (null): devolver una tarea al backlog o soltar a quien la tenía es parte de
 * la planeación de un sprint.
 */
export const UpdateTaskFieldsSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().min(1).optional().nullable(),
  reporterId: z.string().optional().nullable(),
  dueDate: z.string().min(1).optional().nullable(),
  sprintId: z.string().min(1).optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
})

/** Campos que el asignado puede tocar sin ser jefe: ejecutar su tarea. */
export const ASSIGNEE_EDITABLE_FIELDS = [
  'status',
  'description',
  'actualHours',
  'order',
  'tags',
] as const

export const UpdateTaskSchema = UpdateTaskFieldsSchema

export const TaskFiltersSchema = z.object({
  assignedTo: z.string().optional(),
  /** Id de sprint, o "backlog" para las que no están en ninguno. */
  sprintId: z.string().optional(),
  status: z.string().optional(), // comma-separated
  priority: z.string().optional(), // comma-separated
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
})

/**
 * Revaluación. Sin `resolve` es la solicitud del asignado; con `resolve` es la
 * respuesta del jefe, que puede mover la fecha y reabrir la votación.
 */
export const RevaluationSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
  resolve: z.boolean().optional(),
  newDueDate: z.string().min(1).optional().nullable(),
  reopenVoting: z.boolean().optional(),
})

export const ReorderTasksSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0),
      status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']),
    })
  ),
})

/**
 * Voto de valoración. El rango real (2-10 por defecto) es configurable, así que
 * los límites se validan contra los settings en el servicio; aquí solo se exige
 * que sea un entero positivo.
 */
export const CastVoteSchema = z.object({
  value: z.number().int('El voto debe ser un número entero').positive(),
})

/** Aprobacion o rechazo del cumplimiento por parte de un jefe. */
export const ReviewCompletionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(2000).optional().nullable(),
})

export const CreateCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío'),
})

export const UpdateCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío'),
})

export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>
export type AssigneeEditableField = (typeof ASSIGNEE_EDITABLE_FIELDS)[number]
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>
export type TaskFiltersDTO = z.infer<typeof TaskFiltersSchema>
export type ReorderTasksDTO = z.infer<typeof ReorderTasksSchema>
export type CastVoteDTO = z.infer<typeof CastVoteSchema>
export type ReviewCompletionDTO = z.infer<typeof ReviewCompletionSchema>
export type CreateCommentDTO = z.infer<typeof CreateCommentSchema>
export type UpdateCommentDTO = z.infer<typeof UpdateCommentSchema>
