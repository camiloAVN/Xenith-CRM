import { z } from 'zod'

export const cotizacionSchema = z.object({
  // Obligatorios
  name: z
    .string()
    .min(2, 'Nombre muy corto')
    .max(100, 'El nombre no puede exceder 100 caracteres'),

  email: z
    .string()
    .email('Email inválido')
    .max(100, 'El email no puede exceder 100 caracteres'),

  // Opcionales
  phone: z
    .string()
    .max(30, 'Teléfono muy largo')
    .optional()
    .refine(
      (val) => !val || /^[\d\s\-+()]+$/.test(val),
      'Número de teléfono inválido'
    ),

  company: z
    .string()
    .max(100, 'El nombre de la empresa no puede exceder 100 caracteres')
    .optional(),

  message: z
    .string()
    .max(3000, 'El mensaje no puede exceder 3000 caracteres')
    .optional(),
})

export type CotizacionFormData = z.infer<typeof cotizacionSchema>
