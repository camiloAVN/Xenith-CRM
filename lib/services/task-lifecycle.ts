import { prisma } from '@/lib/db/prisma'
import { getProjectLeadIds, getProjectMemberIds } from '@/lib/auth/permissions'
import type { TaskCompletionStatus, TaskStatus, TaskValuationStatus } from '@prisma/client'

/**
 * Máquina de estados de la tarea.
 *
 * Conviven DOS capas independientes sobre la misma tarjeta:
 *
 *   1. Flujo Kanban (`Task.status`: TODO / IN_PROGRESS / REVIEW / DONE / BLOCKED)
 *      Es el tablero de siempre. Cualquier miembro lo mueve arrastrando y NO
 *      dispara nada del sistema de puntos.
 *
 *   2. Puntos, a su vez en dos sub-máquinas:
 *      - Valoración:  VOTING --(cierra la ventana)--> VALUED
 *      - Cumplimiento: PENDING --(el asignado marca terminada)--> SUBMITTED
 *                      SUBMITTED --(todos los jefes requeridos aprueban)--> ACCEPTED
 *                      SUBMITTED --(un jefe rechaza)--> PENDING (+ completionRound)
 *
 * Mover una tarjeta a DONE en el Kanban NO acredita puntos: el crédito ocurre
 * solo al llegar a ACCEPTED. Son capas que conviven, no una sola.
 */

/**
 * Unico movimiento de columna que puede hacer quien NO es jefe: arrancar su
 * propia tarea.
 *
 * Todo lo demas lo maneja el flujo de cumplimiento: marcar terminada la lleva
 * a "En Revision", la aceptacion a "Hecho" y el rechazo de vuelta a "En
 * Progreso". Si el asignado pudiera arrastrarla a "Hecho" a mano, el tablero
 * diria "hecha" sin que ningun jefe la haya aceptado ni se hubieran acreditado
 * los puntos.
 */
export function canAssigneeChangeStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from === 'TODO' && to === 'IN_PROGRESS'
}

export interface LifecycleCheck {
  ok: boolean
  reason?: string
}

const OK: LifecycleCheck = { ok: true }
const deny = (reason: string): LifecycleCheck => ({ ok: false, reason })

export interface TaskLifecycleSnapshot {
  assignedTo: string | null
  valuationStatus: TaskValuationStatus
  completionStatus: TaskCompletionStatus
  pointsValue: unknown | null
}

/**
 * Votantes elegibles: todos los miembros del proyecto MENOS el asignado.
 *
 * Los jefes que no sean el asignado también votan — ser jefe es un permiso
 * encima de ser miembro, no un rol aparte. Por eso un equipo formado solo por
 * jefes funciona sin nada especial: con 3 jefes y la tarea asignada a uno,
 * los otros 2 son votantes normales.
 */
export async function getEligibleVoterIds(
  projectId: string,
  assigneeId: string | null
): Promise<string[]> {
  const members = await getProjectMemberIds(projectId)
  return members.filter((id) => id !== assigneeId)
}

/**
 * Quórum realmente exigible: nunca puede pedir más votos que votantes hay.
 *
 * Sin este tope, un equipo de 2 con `minVotes = 2` jamás alcanzaría quórum
 * (solo 1 votante posible) y todas sus tareas caerían al mínimo del rango.
 */
export function effectiveQuorum(minVotes: number, eligibleVoterCount: number): number {
  return Math.min(minVotes, eligibleVoterCount)
}

/** Jefes globales (dueños) activos — respaldo de aprobación. */
async function getOwnerIds(): Promise<string[]> {
  const owners = await prisma.user.findMany({
    where: { role: 'SUPERADMIN', isActive: true },
    select: { id: true },
  })
  return owners.map((o) => o.id)
}

/**
 * Jefes que deben aprobar el cumplimiento: TODOS los del proyecto menos el
 * asignado. Un jefe nunca firma su propia tarea.
 *
 *   3 jefes, tarea de uno de ellos   -> firman los otros 2
 *   2 jefes, tarea de un miembro     -> firman los 2
 *   2 jefes, tarea de un jefe        -> firma solo el otro
 *   1 jefe,  tarea de ese jefe       -> no queda nadie: firma el dueño
 *
 * El último caso necesita el respaldo del dueño porque la regla pide mínimo 1
 * aprobador; sin él la tarea quedaría bloqueada para siempre.
 */
export async function getRequiredApproverIds(
  projectId: string,
  assigneeId: string | null
): Promise<string[]> {
  const leads = await getProjectLeadIds(projectId)
  const required = leads.filter((id) => id !== assigneeId)

  if (required.length > 0) return required

  const owners = await getOwnerIds()
  return owners.filter((id) => id !== assigneeId)
}

/** El asignado marca la tarea como terminada. */
export function canSubmitCompletion(
  task: TaskLifecycleSnapshot,
  userId: string
): LifecycleCheck {
  if (!task.assignedTo) {
    return deny('La tarea no tiene a nadie asignado')
  }
  if (task.assignedTo !== userId) {
    return deny('Solo quien tiene la tarea asignada puede marcarla como terminada')
  }
  if (task.completionStatus === 'SUBMITTED') {
    return deny('La tarea ya está esperando la revisión de los jefes')
  }
  if (task.completionStatus === 'ACCEPTED') {
    return deny('La tarea ya fue aceptada')
  }
  return OK
}

/** Un jefe aprueba o rechaza un cumplimiento pendiente. */
export function canReviewCompletion(
  task: TaskLifecycleSnapshot,
  userId: string,
  requiredApproverIds: string[]
): LifecycleCheck {
  if (task.completionStatus !== 'SUBMITTED') {
    return deny('La tarea no está pendiente de aceptación')
  }
  if (task.assignedTo === userId) {
    return deny('No puedes aprobar tu propia tarea')
  }
  if (!requiredApproverIds.includes(userId)) {
    return deny('Solo los jefes del proyecto pueden aceptar el cumplimiento')
  }
  return OK
}

/** Un miembro vota el valor en puntos. */
export function canVoteOnTask(
  task: TaskLifecycleSnapshot,
  userId: string,
  eligibleVoterIds: string[],
  votingClosesAt: Date | null,
  now: Date = new Date()
): LifecycleCheck {
  if (task.valuationStatus === 'VALUED') {
    return deny('La votación de esta tarea ya cerró')
  }
  if (task.assignedTo === userId) {
    return deny('No puedes votar el valor de tu propia tarea')
  }
  if (!eligibleVoterIds.includes(userId)) {
    return deny('Solo los miembros del proyecto pueden votar')
  }
  if (votingClosesAt && votingClosesAt <= now) {
    return deny('La ventana de votación ya venció')
  }
  return OK
}
