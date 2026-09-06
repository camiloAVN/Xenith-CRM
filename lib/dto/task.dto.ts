import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(255),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  // Asignado y fecha límite son obligatorios: sin asignado no hay a quién
  // acreditar los puntos, y sin fecha límite no hay penalización que calcular.
  assignedTo: z.string().min(1, 'Debes asignar la tarea a alguien'),
  reporterId: z.string().optional().nullable(),
  dueDate: z.string().min(1, 'La tarea necesita una fecha límite'),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional().default([]),
})

/**
 * Actualización: aquí `assignedTo` y `dueDate` sí pueden venir sueltos o
 * ausentes, pero nunca vaciarse — una tarea ya creada no puede quedarse sin
 * asignado ni sin fecha límite.
 */
export const UpdateTaskFieldsSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().min(1, 'La tarea necesita un asignado').optional(),
  reporterId: z.string().optional().nullable(),
  dueDate: z.string().min(1, 'La tarea necesita una fecha límite').optional(),
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
  status: z.string().optional(), // comma-separated
  priority: z.string().optional(), // comma-separated
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().optional(),
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
