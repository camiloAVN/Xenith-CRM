import { z } from 'zod'

/**
 * Liquidación. Sin `amount` se reparte todo lo que falta por liquidar; con él,
 * solo esa parte (por ejemplo, un anticipo del cliente).
 */
export const CreatePayoutSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
})

export type CreatePayoutDTO = z.infer<typeof CreatePayoutSchema>
