import { prisma } from '@/lib/db/prisma'
import type { ProjectRole } from '@prisma/client'

/**
 * Modelo de permisos del sistema de puntos de aporte.
 *
 *  - Dueño  → rol global SUPERADMIN. Crea proyectos, nombra jefes y configura
 *             los parámetros del sistema.
 *  - Jefe   → ProjectMember con rol PROJECT_MANAGER o ADMIN en ESE proyecto.
 *             Crea tareas, las asigna y acepta el cumplimiento.
 *  - Miembro→ cualquier ProjectMember. Ejecuta tareas y vota su valor.
 *
 * Ser jefe es un permiso ENCIMA de ser miembro, no un rol aparte: un jefe
 * también puede tener tareas asignadas y ganar puntos.
 */

/** Roles de proyecto que cuentan como jefe. */
export const PROJECT_LEAD_ROLES: ProjectRole[] = ['PROJECT_MANAGER', 'ADMIN']

export interface ProjectPermissions {
  /** SUPERADMIN global. */
  isOwner: boolean
  /** Jefe de ESTE proyecto. */
  isLead: boolean
  /** Miembro de ESTE proyecto (todo jefe lo es). */
  isMember: boolean
  projectRole: ProjectRole | null
  /** Agregar/quitar miembros que no son jefes. */
  canManageMembers: boolean
  /** Nombrar o destituir jefes de proyecto — solo el dueño. */
  canManageLeads: boolean
  /** Crear tareas, asignarlas y aceptar cumplimientos. */
  canManageTasks: boolean
  /** Votar el valor en puntos de las tareas de otros. */
  canVote: boolean
  /** Editar los parámetros del sistema para este proyecto. */
  canEditSettings: boolean
}

/** Rol global + permiso puntual de creación de proyectos. */
export async function getUserAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canCreateProjects: true, isActive: true },
  })
  return {
    role: user?.role ?? null,
    isOwner: user?.role === 'SUPERADMIN',
    // El dueño siempre puede; los demás solo con el permiso explícito que
    // únicamente el dueño puede otorgar.
    canCreateProjects: user?.role === 'SUPERADMIN' || user?.canCreateProjects === true,
    isActive: user?.isActive ?? false,
  }
}

export async function isOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'SUPERADMIN'
}

export async function canCreateProjects(userId: string): Promise<boolean> {
  return (await getUserAccess(userId)).canCreateProjects
}

/**
 * Permisos de un usuario dentro de un proyecto concreto.
 *
 * El líder del proyecto (`Project.assignedTo`) cuenta como jefe aunque no
 * tenga fila en ProjectMember: los proyectos creados antes de que existiera
 * esa tabla no la tienen y de otro modo se quedarían sin ningún jefe.
 */
export async function getProjectPermissions(
  projectId: string,
  userId: string
): Promise<ProjectPermissions> {
  const [access, project, membership] = await Promise.all([
    getUserAccess(userId),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedTo: true },
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    }),
  ])

  const owner = access.isOwner
  const isProjectLeader = project?.assignedTo === userId
  const isLead =
    isProjectLeader || (membership != null && PROJECT_LEAD_ROLES.includes(membership.role))
  const isMember = membership != null || isProjectLeader

  return {
    isOwner: owner,
    isLead,
    isMember,
    projectRole: membership?.role ?? null,
    canManageMembers: owner || isLead,
    canManageLeads: owner,
    canManageTasks: owner || isLead,
    canVote: isMember,
    canEditSettings: owner,
  }
}

/**
 * Jefes reales del proyecto. Es el conjunto que define el quórum de
 * aceptación de cumplimiento, así que NO incluye al dueño por ser dueño:
 * si lo hiciera, ninguna tarea podría aceptarse sin su firma en proyectos
 * donde ni siquiera participa.
 */
export async function getProjectLeadIds(projectId: string): Promise<string[]> {
  const [project, leads] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedTo: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId, role: { in: PROJECT_LEAD_ROLES } },
      select: { userId: true },
    }),
  ])

  const ids = new Set(leads.map((l) => l.userId))
  if (project?.assignedTo) ids.add(project.assignedTo)
  return [...ids]
}

/** Todos los miembros del proyecto, incluido el líder. */
export async function getProjectMemberIds(projectId: string): Promise<string[]> {
  const [project, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { assignedTo: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    }),
  ])

  const ids = new Set(members.map((m) => m.userId))
  if (project?.assignedTo) ids.add(project.assignedTo)
  return [...ids]
}
