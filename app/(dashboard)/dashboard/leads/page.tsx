'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LeadsTable } from '@/components/dashboard/LeadsTable'
import { cn } from '@/lib/utils/cn'
import {
  Lead,
  LeadStatus,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/lib/validations/lead'
import { Search, RefreshCw, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'

type Filter = LeadStatus | 'ALL'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [localSearch, setLocalSearch] = useState('')

  const fetchLeads = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter !== 'ALL') params.set('status', filter)

      const res = await fetch(`/api/leads?${params.toString()}`)
      if (!res.ok) throw new Error('fetch failed')

      const data = await res.json()
      setLeads(data.leads)
      setCounts(data.counts)
      setTotal(data.total)
    } catch {
      toast.error('No se pudieron cargar los leads')
    } finally {
      setIsLoading(false)
    }
  }, [search, filter])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    // Optimista: el select ya se ve cambiado, revertimos si el server falla.
    const previous = leads
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Marcado como ${LEAD_STATUS_LABELS[status].toLowerCase()}`)
      fetchLeads()
    } catch {
      setLeads(previous)
      toast.error('No se pudo actualizar el estado')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Solicitud eliminada')
      fetchLeads()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'ALL', label: 'Todos', count: total },
    ...LEAD_STATUSES.map((s) => ({
      key: s as Filter,
      label: LEAD_STATUS_LABELS[s],
      count: counts[s] ?? 0,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Inbox className="w-7 h-7 text-violet-400" />
            Leads
          </h1>
          <p className="text-gray-400 mt-1">
            Solicitudes recibidas desde el formulario de la web
          </p>
        </div>
        <Button variant="outline" onClick={fetchLeads} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <Card>
        <Card.Header>
          <div className="space-y-4">
            {/* Filtros por estado */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200',
                    filter === tab.key
                      ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                      : 'text-gray-400 border-gray-800 hover:text-white hover:bg-gray-900'
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'ml-2 text-xs',
                      filter === tab.key ? 'text-violet-300' : 'text-gray-600'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(localSearch)
              }}
              className="flex gap-2"
            >
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre, email, empresa o mensaje..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </form>
          </div>
        </Card.Header>

        <Card.Content>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 mt-4">Cargando leads...</p>
            </div>
          ) : (
            <LeadsTable
              leads={leads}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
