'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { SUPERADMIN_EMAIL } from '@/lib/validations/user'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  User,
  Plus,
  Pencil,
  Trash2,
  X,
  FolderKanban,
  ChevronDown,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type EarningType = 'COMPANY_INCOME' | 'DEDUCTION' | 'USER_EARNING'

interface Earning {
  id: string
  description: string
  amount: number
  type: EarningType
  projectId: string | null
  userId: string | null
  project?: { id: string; title: string } | null
  user?: { id: string; name: string; email: string } | null
  createdAt: string
}

interface ProjectTotal {
  projectId: string | null
  title: string
  income: number
  deductions: number
  total: number
}

interface Project { id: string; title: string }
interface AllowedProject { id: string; title: string }
interface UserOption { id: string; name: string | null; email: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EarningType, string> = {
  COMPANY_INCOME: 'Ingreso empresa',
  DEDUCTION: 'Deducción',
  USER_EARNING: 'Ganancia usuario',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: 'violet' | 'green' | 'red' | 'blue'
}) {
  const colors = {
    violet: 'text-violet-400 bg-violet-500/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  }
  return (
    <Card variant="glass" className="flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className={cn('text-xl font-bold truncate', value < 0 ? 'text-red-400' : 'text-gray-100')}>
          {fmt(value)}
        </p>
      </div>
    </Card>
  )
}

function TypeBadge({ type }: { type: EarningType }) {
  const styles: Record<EarningType, string> = {
    COMPANY_INCOME: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    DEDUCTION: 'bg-red-500/10 text-red-400 border-red-500/20',
    USER_EARNING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', styles[type])}>
      {TYPE_LABELS[type]}
    </span>
  )
}

// ─── Modal form ──────────────────────────────────────────────────────────────

interface ModalProps {
  earning: Partial<Earning> | null
  projects: Project[]
  users: UserOption[]
  onClose: () => void
  onSave: (data: Omit<Earning, 'id' | 'createdAt' | 'project' | 'user'>) => Promise<void>
  saving: boolean
}

function EarningModal({ earning, projects, users, onClose, onSave, saving }: ModalProps) {
  const [form, setForm] = useState({
    description: earning?.description ?? '',
    amount: earning?.amount?.toString() ?? '',
    type: (earning?.type ?? 'COMPANY_INCOME') as EarningType,
    projectId: earning?.projectId ?? '',
    userId: earning?.userId ?? '',
  })

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      projectId: form.projectId || null,
      userId: form.type === 'USER_EARNING' ? (form.userId || null) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-bold">{earning?.id ? 'Editar registro' : 'Nuevo registro'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Descripción *"
            placeholder="Ej: Pago proyecto cliente X"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monto (COP) *"
              type="number"
              step="any"
              placeholder="5000000"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Tipo *</label>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                >
                  <option value="COMPANY_INCOME">Ingreso empresa</option>
                  <option value="DEDUCTION">Deducción</option>
                  <option value="USER_EARNING">Ganancia usuario</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Proyecto (opcional)</label>
            <div className="relative">
              <select
                value={form.projectId}
                onChange={(e) => set('projectId', e.target.value)}
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
              >
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {form.type === 'USER_EARNING' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Usuario *</label>
              <div className="relative">
                <select
                  value={form.userId}
                  onChange={(e) => set('userId', e.target.value)}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  required
                >
                  <option value="">Seleccionar usuario</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Usa valores negativos para deducciones (ej: -500000 para gastos operativos, impuestos, etc.)
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              {earning?.id ? 'Guardar cambios' : 'Crear registro'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GananciasPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.email === SUPERADMIN_EMAIL

  // Data
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [myEarnings, setMyEarnings] = useState<Earning[]>([])
  const [projectTotals, setProjectTotals] = useState<ProjectTotal[]>([])
  const [allowedProjects, setAllowedProjects] = useState<AllowedProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterProject, setFilterProject] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEarning, setEditingEarning] = useState<Earning | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEarnings = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterProject
        ? `/api/ganancias?projectId=${filterProject}`
        : '/api/ganancias'
      const res = await fetch(url)
      const data = await res.json()

      if (isSuperAdmin) {
        // Prisma Decimal se serializa como string — convertir a number
        setEarnings((data as Earning[]).map((e) => ({ ...e, amount: Number(e.amount) })))
      } else {
        setMyEarnings((data.myEarnings ?? []).map((e: Earning) => ({ ...e, amount: Number(e.amount) })))
        setProjectTotals(
          (data.projectTotals ?? []).map((p: ProjectTotal) => ({
            ...p,
            income: Number(p.income),
            deductions: Number(p.deductions),
            total: Number(p.total),
          }))
        )
        setAllowedProjects(data.allowedProjects ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [filterProject, isSuperAdmin])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) return
      const data = await res.json()
      const list = data?.projects ?? data
      setProjects(Array.isArray(list) ? list : [])
    } catch { /* ignorar errores de red al hacer logout */ }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) return
      const data = await res.json()
      const list = data?.users ?? data
      setUsers(Array.isArray(list) ? list : [])
    } catch { /* ignorar errores de red al hacer logout */ }
  }, [])

  useEffect(() => {
    fetchEarnings()
  }, [fetchEarnings])

  useEffect(() => {
    fetchProjects()
    if (isSuperAdmin) fetchUsers()
  }, [fetchProjects, fetchUsers, isSuperAdmin])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleSave = async (data: Omit<Earning, 'id' | 'createdAt' | 'project' | 'user'>) => {
    setSaving(true)
    try {
      const isEdit = !!editingEarning?.id
      const url = isEdit ? `/api/ganancias/${editingEarning!.id}` : '/api/ganancias'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setModalOpen(false)
        setEditingEarning(null)
        await fetchEarnings()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return
    await fetch(`/api/ganancias/${id}`, { method: 'DELETE' })
    await fetchEarnings()
  }

  // ── Stats (SUPERADMIN) ─────────────────────────────────────────────────────

  const totalIncome = earnings
    .filter((e) => e.type === 'COMPANY_INCOME')
    .reduce((s, e) => s + e.amount, 0)

  // Siempre tratamos la magnitud absoluta de las deducciones para restarla
  const totalDeductions = earnings
    .filter((e) => e.type === 'DEDUCTION')
    .reduce((s, e) => s + Math.abs(e.amount), 0)

  const totalUserEarnings = earnings
    .filter((e) => e.type === 'USER_EARNING')
    .reduce((s, e) => s + e.amount, 0)

  // Neto = ingresos − deducciones − ganancias pagadas al equipo
  const netTotal = totalIncome - totalDeductions - totalUserEarnings

  // ── Stats (user) ───────────────────────────────────────────────────────────

  const myTotal = myEarnings.reduce((s, e) => s + e.amount, 0)
  const allProjectsTotal = projectTotals.reduce((s, p) => s + p.total, 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  // Usuario sin proyectos asignados → pantalla de acceso restringido
  if (!isSuperAdmin && !loading && allowedProjects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Ganancias</h1>
          <p className="text-gray-400 mt-1 text-sm">Tu ganancia personal y totales por proyecto</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
            <DollarSign className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-300 mb-2">Sin proyectos asignados</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            No tienes proyectos asociados. Las ganancias solo son visibles para los miembros del equipo de cada proyecto.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ganancias</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {isSuperAdmin
              ? 'Vista completa de ingresos, deducciones y ganancias del equipo'
              : 'Tu ganancia personal y totales de tus proyectos'}
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            variant="primary"
            onClick={() => { setEditingEarning(null); setModalOpen(true) }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo registro
          </Button>
        )}
      </div>

      {/* Stats */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Ingresos" value={totalIncome} icon={TrendingUp} color="green" />
          <StatCard label="Total Deducciones" value={-totalDeductions} icon={TrendingDown} color="red" />
          <StatCard label="Ganancias Equipo" value={-totalUserEarnings} icon={User} color="blue" />
          <StatCard label="Lo que me queda (Neto)" value={netTotal} icon={DollarSign} color="violet" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Mi Ganancia Total" value={myTotal} icon={User} color="blue" />
          <StatCard label="Ganancia Total mis Proyectos" value={allProjectsTotal} icon={DollarSign} color="violet" />
        </div>
      )}

      {/* Totales por proyecto (user view) */}
      {!isSuperAdmin && projectTotals.length > 0 && (
        <Card variant="glass" className="overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-bold flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-violet-400" />
              Ganancia por proyecto
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyecto</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ingresos</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Deducciones</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ganancia del proyecto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {projectTotals.map((pt) => (
                  <tr key={pt.projectId} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-gray-200 font-medium">{pt.title}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 tabular-nums">{fmt(pt.income)}</td>
                    <td className="px-6 py-4 text-right text-red-400 tabular-nums">{fmt(-pt.deductions)}</td>
                    <td className={cn('px-6 py-4 text-right font-bold tabular-nums', pt.total < 0 ? 'text-red-400' : 'text-emerald-400')}>
                      {fmt(pt.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filtro por proyecto */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
          >
            <option value="">Todos los proyectos</option>
            {(isSuperAdmin ? projects : allowedProjects).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {filterProject && (
          <button
            onClick={() => setFilterProject('')}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla SUPERADMIN */}
      {isSuperAdmin && (
        <Card variant="glass" className="overflow-hidden p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : earnings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay registros aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyecto</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Usuario</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {earnings.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-gray-200 max-w-[200px] truncate">{e.description}</td>
                      <td className="px-6 py-4">
                        <TypeBadge type={e.type} />
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{e.project?.title ?? '—'}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {e.user ? (e.user.name ?? e.user.email) : '—'}
                      </td>
                      <td className={cn('px-6 py-4 text-right font-semibold tabular-nums', e.amount < 0 ? 'text-red-400' : 'text-emerald-400')}>
                        {fmt(e.amount)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 text-xs whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingEarning(e); setModalOpen(true) }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tabla usuario — solo sus ganancias personales */}
      {!isSuperAdmin && (
        <Card variant="glass" className="overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Mi ganancia personal
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myEarnings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aún no tienes ganancias registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyecto</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {myEarnings.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-gray-200">{e.description}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{e.project?.title ?? '—'}</td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-400 tabular-nums">
                        {fmt(e.amount)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 text-xs whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal */}
      {modalOpen && (
        <EarningModal
          earning={editingEarning}
          projects={projects}
          users={users}
          onClose={() => { setModalOpen(false); setEditingEarning(null) }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
