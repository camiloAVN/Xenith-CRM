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

export const LEAD_SOURCES = ['WEB', 'VECTOR'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEB: 'Web',
  VECTOR: 'Vector',
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
  source: LeadSource
  createdAt: string
  updatedAt: string
}
