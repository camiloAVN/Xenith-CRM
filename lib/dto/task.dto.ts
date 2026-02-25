import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(255),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assignedTo: z.string().optional().nullable(),
  reporterId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  actualHours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional().default([]),
})

export const UpdateTaskSchema = CreateTaskSchema.partial()

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

export const CreateCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío'),
})

export const UpdateCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío'),
})

export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>
export type TaskFiltersDTO = z.infer<typeof TaskFiltersSchema>
export type ReorderTasksDTO = z.infer<typeof ReorderTasksSchema>
export type CreateCommentDTO = z.infer<typeof CreateCommentSchema>
export type UpdateCommentDTO = z.infer<typeof UpdateCommentSchema>
