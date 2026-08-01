'use client'

import { Fragment, useState } from 'react'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import {
  Lead,
  LeadStatus,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/lib/validations/lead'
import {
  Trash2,
  ChevronDown,
  Mail,
  Phone,
  Building2,
  MessageSquare,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_VARIANT: Record<
  LeadStatus,
  'default' | 'success' | 'warning' | 'error' | 'info'
> = {
  NEW: 'info',
  CONTACTED: 'warning',
  QUALIFIED: 'warning',
  CONVERTED: 'success',
  DISCARDED: 'default',
}

interface LeadsTableProps {
  leads: Lead[]
  onStatusChange: (id: string, status: LeadStatus) => void
  onDelete: (id: string) => void
}

export function LeadsTable({ leads, onStatusChange, onDelete }: LeadsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-400">No hay solicitudes que coincidan</p>
        <p className="text-sm text-gray-500 mt-2">
          Las solicitudes del formulario de la web aparecerán aquí
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <th className="w-8"></th>
            <th>Nombre</th>
            <th>Contacto</th>
            <th>Empresa</th>
            <th>Recibido</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const isOpen = expanded === lead.id
            const createdAt = new Date(lead.createdAt)

            return (
              <Fragment key={lead.id}>
                <tr
                  className={cn(
                    'cursor-pointer transition-colors',
                    isOpen && 'bg-gray-900/40'
                  )}
                  onClick={() => setExpanded(isOpen ? null : lead.id)}
                >
                  <td>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-gray-500 transition-transform',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </td>

                  <td className="font-medium whitespace-nowrap">
                    {lead.name}
                    {lead.status === 'NEW' && (
                      <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-violet-400 align-middle" />
                    )}
                  </td>

                  <td>
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-violet-400 hover:text-violet-300 text-sm inline-flex items-center gap-1.5"
                      >
                        <Mail className="w-3 h-3 shrink-0" />
                        {lead.email}
                      </a>
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-400 hover:text-gray-300 text-sm inline-flex items-center gap-1.5"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          {lead.phone}
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="text-gray-400">{lead.company || '—'}</td>

                  <td className="whitespace-nowrap">
                    <span title={format(createdAt, "d 'de' MMMM yyyy, HH:mm", { locale: es })}>
                      {formatDistanceToNow(createdAt, {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </td>

                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        onStatusChange(lead.id, e.target.value as LeadStatus)
                      }
                      className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      title="Eliminar"
                      onClick={() => {
                        if (
                          confirm(
                            `¿Eliminar la solicitud de ${lead.name}? Esta acción no se puede deshacer.`
                          )
                        ) {
                          onDelete(lead.id)
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-gray-900/40">
                    <td colSpan={7} className="pt-0">
                      <div className="pl-8 pr-4 pb-4 space-y-3">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            {lead.company || 'Sin empresa'}
                          </span>
                          <span>
                            Recibido el{' '}
                            {format(createdAt, "d 'de' MMMM yyyy 'a las' HH:mm", {
                              locale: es,
                            })}
                          </span>
                          <Badge variant={STATUS_VARIANT[lead.status]}>
                            {LEAD_STATUS_LABELS[lead.status]}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1.5">
                            Mensaje
                          </p>
                          {lead.message ? (
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap max-w-3xl">
                              {lead.message}
                            </p>
                          ) : (
                            <p className="text-gray-500 italic">
                              No dejó mensaje
                            </p>
                          )}
                        </div>

                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(
                            'Re: Tu solicitud en Xenith'
                          )}`}
                          className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300"
                        >
                          <Mail className="w-4 h-4" />
                          Responder a {lead.name}
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
