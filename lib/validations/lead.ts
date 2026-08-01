import { z } from 'zod'

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'DISCARDED',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  DISCARDED: 'Descartado',
}

export const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES),
})

export interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  message: string | null
  status: LeadStatus
  createdAt: string
  updatedAt: string
}
